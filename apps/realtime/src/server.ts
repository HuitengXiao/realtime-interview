import { createServer } from "node:http";
import { db } from "@repo/database";
import {
	AliyunParaformerStream,
	type PcmUtterance,
	PcmUtteranceSegmenter,
	type RealtimeTokenPayload,
	type TranscriptSegment,
	addInterviewMessage,
	aliyunSettings,
	getInterviewAccess,
	pcm16DurationMs,
	pcm16Rms,
	realtimeClientEventSchema,
	saveInterviewNotes,
	splitTranscriptSegment,
	transcribePcm,
	translateText,
	upsertFinalTranscriptSegment,
	verifyRealtimeToken,
} from "@repo/interview";
import WebSocket, { WebSocketServer } from "ws";

const port = Number(process.env.INTERVIEW_REALTIME_PORT || 3001);
const production = process.env.NODE_ENV === "production";
const maximumSessionMs =
	Number(process.env.INTERVIEW_MAX_SESSION_MINUTES || 120) * 60_000;
const maximumRoomConnections = 20;
const maximumUserConnections = 3;
const allowedOrigins = new Set(
	(process.env.INTERVIEW_ALLOWED_ORIGIN || "http://localhost:3000")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
);

type Configuration = {
	sourceLang: string;
	targetLang: string;
	asrEngine: "aliyun" | "cloud";
	silenceMs: number;
	lineWidth: number;
	translationIntervalMs: number;
};

type PartialTranslationState = {
	latestSegment: TranscriptSegment;
	firstSeenAt: number;
	lastStartedAt: number;
	lastStartedText?: string;
	inFlight: boolean;
	finalized: boolean;
};

type Session = {
	socket: WebSocket;
	auth?: RealtimeTokenPayload;
	config?: Configuration;
	aliyun?: AliyunParaformerStream;
	aliyunReceive?: Promise<void>;
	closed: boolean;
	stopping: boolean;
	configuredAt: number;
	receivedAudioMs: number;
	expiryTimer?: ReturnType<typeof setTimeout>;
	accessTimer?: ReturnType<typeof setInterval>;
	accessCheckInFlight: boolean;
	eventQueue: Promise<void>;
	audioClockMs: number;
	cloudSegmenter?: PcmUtteranceSegmenter;
	cloudFlush: Promise<void>;
	partialTranslations: Map<string, PartialTranslationState>;
};

const rooms = new Map<string, Set<Session>>();

function send(session: Session, event: unknown) {
	if (session.socket.readyState === WebSocket.OPEN) {
		session.socket.send(JSON.stringify(event));
	}
}

function fail(session: Session, code: string, message: string) {
	send(session, { type: "error", code, message });
}

function roomSessions(interviewId: string) {
	let sessions = rooms.get(interviewId);
	if (!sessions) {
		sessions = new Set();
		rooms.set(interviewId, sessions);
	}
	return sessions;
}

function members(interviewId: string) {
	const unique = new Map<string, { userId: string; displayName: string }>();
	for (const session of rooms.get(interviewId) ?? []) {
		if (session.auth) {
			unique.set(session.auth.userId, {
				userId: session.auth.userId,
				displayName: session.auth.displayName,
			});
		}
	}
	return [...unique.values()];
}

function broadcast(interviewId: string, event: unknown) {
	for (const session of rooms.get(interviewId) ?? []) {
		send(session, event);
	}
}

function broadcastMembers(interviewId: string) {
	broadcast(interviewId, {
		type: "members_update",
		members: members(interviewId),
	});
}

async function refreshSessionAccess(session: Session) {
	if (!session.auth || session.accessCheckInFlight || session.closed) {
		return;
	}
	session.accessCheckInFlight = true;
	try {
		const access = await getInterviewAccess(db, {
			userId: session.auth.userId,
			interviewId: session.auth.interviewId,
		});
		if (!access || access.organizationId !== session.auth.organizationId) {
			session.socket.close(1008, "Interview access revoked");
			return;
		}
		const recordingPermissionRevoked =
			session.auth.canRecord && !access.canRecord;
		session.auth = { ...session.auth, canRecord: access.canRecord };
		if (recordingPermissionRevoked) {
			session.socket.close(1008, "Recording permission revoked");
		}
	} catch {
		session.socket.close(1011, "Unable to verify interview access");
	} finally {
		session.accessCheckInFlight = false;
	}
}

function publicSegment(
	segment: TranscriptSegment,
	config: Configuration,
	isFinal: boolean,
	translationState?: { isPartial: boolean; sourceText: string },
) {
	return {
		segmentKey: segment.segmentKey,
		...(segment.speaker ? { speaker: segment.speaker } : {}),
		text: segment.text,
		...(segment.translation ? { translation: segment.translation } : {}),
		sourceLang: segment.sourceLang || segment.language || config.sourceLang,
		targetLang: segment.targetLang || config.targetLang,
		...(segment.translationEngine
			? { translationEngine: segment.translationEngine }
			: {}),
		startMs: segment.startMs,
		endMs: segment.endMs,
		isFinal,
		...(translationState
			? {
					translationIsPartial: translationState.isPartial,
					translationSourceText: translationState.sourceText,
				}
			: {}),
	};
}

async function publishSegmentPart(
	session: Session,
	segment: TranscriptSegment,
	isFinal: boolean,
) {
	const auth = session.auth;
	const config = session.config;
	if (!auth || !config || session.closed) {
		return;
	}

	broadcast(auth.interviewId, {
		type: "segment",
		segment: publicSegment(segment, config, isFinal),
	});
	if (!isFinal) {
		queuePartialTranslation(session, segment);
		return;
	}
	const partialState = session.partialTranslations.get(segment.segmentKey);
	if (partialState) {
		partialState.finalized = true;
	}

	const normalized: TranscriptSegment = {
		...segment,
		sourceLang: config.sourceLang,
		targetLang: config.targetLang,
	};
	await upsertFinalTranscriptSegment(db, auth.interviewId, normalized);

	if (
		config.targetLang === "auto" ||
		config.targetLang === config.sourceLang
	) {
		session.partialTranslations.delete(segment.segmentKey);
		return;
	}
	try {
		const translation = await translateText(segment.text, {
			sourceLanguage: config.sourceLang,
			targetLanguage: config.targetLang,
		});
		const translated = {
			...normalized,
			translation,
			translationEngine: "cloud",
		};
		await upsertFinalTranscriptSegment(db, auth.interviewId, translated);
		broadcast(auth.interviewId, {
			type: "segment",
			segment: publicSegment(translated, config, true),
		});
	} catch (error) {
		fail(
			session,
			"TRANSLATION_FAILED",
			error instanceof Error ? error.message : "Translation failed",
		);
	} finally {
		session.partialTranslations.delete(segment.segmentKey);
	}
}

function queuePartialTranslation(session: Session, segment: TranscriptSegment) {
	const auth = session.auth;
	const config = session.config;
	if (
		!auth ||
		!config ||
		session.closed ||
		config.targetLang === "auto" ||
		config.targetLang === config.sourceLang
	) {
		return;
	}
	const now = Date.now();
	let state = session.partialTranslations.get(segment.segmentKey);
	if (!state) {
		state = {
			latestSegment: segment,
			firstSeenAt: now,
			lastStartedAt: 0,
			inFlight: false,
			finalized: false,
		};
		session.partialTranslations.set(segment.segmentKey, state);
	} else {
		state.latestSegment = segment;
	}
	const lastBoundary = state.lastStartedAt || state.firstSeenAt;
	if (
		state.finalized ||
		state.inFlight ||
		state.lastStartedText === segment.text ||
		now - lastBoundary < config.translationIntervalMs
	) {
		return;
	}
	state.inFlight = true;
	state.lastStartedAt = now;
	const snapshot = segment.text;
	state.lastStartedText = snapshot;
	const expectedState = state;
	void translateText(snapshot, {
		sourceLanguage: config.sourceLang,
		targetLanguage: config.targetLang,
	})
		.then((translation) => {
			const current = session.partialTranslations.get(segment.segmentKey);
			if (
				current !== expectedState ||
				current.finalized ||
				session.closed
			) {
				return;
			}
			broadcast(auth.interviewId, {
				type: "segment",
				segment: publicSegment(
					{
						...current.latestSegment,
						translation,
						translationEngine: "cloud",
					},
					config,
					false,
					{ isPartial: true, sourceText: snapshot },
				),
			});
		})
		.catch((error) => {
			if (!session.closed && !expectedState.finalized) {
				fail(
					session,
					"TRANSLATION_FAILED",
					error instanceof Error
						? error.message
						: "Translation failed",
				);
			}
		})
		.finally(() => {
			expectedState.inFlight = false;
		});
}

async function publishSegment(
	session: Session,
	segment: TranscriptSegment,
	isFinal: boolean,
) {
	const lineWidth = session.config?.lineWidth ?? 100;
	await Promise.all(
		splitTranscriptSegment(segment, lineWidth).map((part) =>
			publishSegmentPart(session, part, isFinal),
		),
	);
}

async function receiveAliyun(session: Session) {
	try {
		while (!session.closed && session.aliyun) {
			const event = await session.aliyun.receiveEvent();
			if (!event) {
				break;
			}
			await publishSegment(session, event.segment, event.isFinal);
		}
	} catch (error) {
		if (!session.closed && !session.stopping) {
			fail(
				session,
				"ASR_FAILED",
				error instanceof Error ? error.message : "ASR stream failed",
			);
		}
	}
}

async function transcribeCloudUtterance(
	session: Session,
	utterance: PcmUtterance,
) {
	const config = session.config;
	if (!config) {
		return;
	}
	try {
		const segments = await transcribePcm(utterance.pcm, {
			language: config.sourceLang,
			baseStartMs: utterance.startMs,
		});
		for (const segment of segments) {
			await publishSegment(session, segment, true);
		}
	} catch (error) {
		fail(
			session,
			"ASR_FAILED",
			error instanceof Error ? error.message : "Cloud ASR failed",
		);
	}
}

function queueCloudAudio(session: Session, pcm: Uint8Array) {
	const segmenter = session.cloudSegmenter;
	if (!segmenter) {
		throw new Error("Cloud ASR segmenter is not configured");
	}
	const { rms, durationMs, utterance } = segmenter.push(pcm);
	send(session, { type: "level", rms, durationMs: Math.round(durationMs) });
	if (utterance) {
		session.cloudFlush = session.cloudFlush.then(() =>
			transcribeCloudUtterance(session, utterance),
		);
	}
}

async function configure(
	session: Session,
	input: Configuration & { token: string },
) {
	if (session.auth) {
		throw new Error("Session is already configured");
	}
	const signedAuth = verifyRealtimeToken(input.token);
	const access = await getInterviewAccess(db, {
		userId: signedAuth.userId,
		interviewId: signedAuth.interviewId,
	});
	if (!access || access.organizationId !== signedAuth.organizationId) {
		throw new Error("Interview access is no longer valid");
	}
	const existingSessions = rooms.get(signedAuth.interviewId) ?? new Set();
	if (existingSessions.size >= maximumRoomConnections) {
		throw new Error("This interview has reached its connection limit");
	}
	const userConnections = [...existingSessions].filter(
		(item) => item.auth?.userId === signedAuth.userId,
	).length;
	if (userConnections >= maximumUserConnections) {
		throw new Error(
			"You have reached the connection limit for this interview",
		);
	}
	const auth = { ...signedAuth, canRecord: access.canRecord };
	session.auth = auth;
	session.configuredAt = Date.now();
	session.config = {
		sourceLang: input.sourceLang,
		targetLang: input.targetLang,
		asrEngine: input.asrEngine,
		silenceMs: input.silenceMs,
		lineWidth: input.lineWidth,
		translationIntervalMs: input.translationIntervalMs,
	};
	try {
		if (input.asrEngine === "aliyun" && auth.canRecord) {
			const settings = aliyunSettings();
			session.aliyun = new AliyunParaformerStream(
				{ ...settings, maxSentenceSilence: input.silenceMs },
				input.sourceLang,
			);
			await session.aliyun.start();
			session.aliyunReceive = receiveAliyun(session);
		} else if (input.asrEngine === "cloud" && auth.canRecord) {
			session.cloudSegmenter = new PcmUtteranceSegmenter(
				input.silenceMs,
				0.012,
				input.translationIntervalMs,
			);
		}
	} catch (error) {
		session.auth = undefined;
		session.config = undefined;
		await session.aliyun?.close();
		session.aliyun = undefined;
		throw error;
	}
	roomSessions(auth.interviewId).add(session);
	session.expiryTimer = setTimeout(
		() => session.socket.close(1008, "Realtime token expired"),
		Math.max(1, auth.exp * 1000 - Date.now()),
	);
	session.accessTimer = setInterval(
		() => void refreshSessionAccess(session),
		30_000,
	);

	send(session, {
		type: "ready",
		interviewId: auth.interviewId,
		member: { userId: auth.userId, displayName: auth.displayName },
	});
	send(session, {
		type: "configured",
		sourceLang: input.sourceLang,
		targetLang: input.targetLang,
		asrEngine: input.asrEngine,
		silenceMs: input.silenceMs,
		lineWidth: input.lineWidth,
		translationIntervalMs: input.translationIntervalMs,
	});
	broadcastMembers(auth.interviewId);
}

async function stopSession(session: Session, notify = true) {
	if (session.closed || session.stopping) {
		return;
	}
	session.stopping = true;
	try {
		if (session.aliyun) {
			try {
				await session.aliyun.finish();
				if (session.aliyunReceive) {
					await Promise.race([
						session.aliyunReceive,
						new Promise<void>((resolve) =>
							setTimeout(resolve, 3_000),
						),
					]);
				}
			} finally {
				await session.aliyun.close();
			}
		}
		if (session.config?.asrEngine === "cloud") {
			const finalUtterance = session.cloudSegmenter?.flush();
			if (finalUtterance) {
				session.cloudFlush = session.cloudFlush.then(() =>
					transcribeCloudUtterance(session, finalUtterance),
				);
			}
			await session.cloudFlush;
		}
		if (notify) {
			send(session, { type: "stopped" });
		}
	} finally {
		session.partialTranslations.clear();
		if (session.expiryTimer) {
			clearTimeout(session.expiryTimer);
		}
		if (session.accessTimer) {
			clearInterval(session.accessTimer);
		}
		session.closed = true;
		const interviewId = session.auth?.interviewId;
		if (interviewId) {
			const sessions = rooms.get(interviewId);
			sessions?.delete(session);
			if (!sessions?.size) {
				rooms.delete(interviewId);
			} else {
				broadcastMembers(interviewId);
			}
		}
	}
}

async function handleText(session: Session, text: string) {
	const event = realtimeClientEventSchema.parse(JSON.parse(text));
	if (event.type === "configure") {
		await configure(session, event);
		return;
	}
	if (!session.auth || !session.config) {
		throw new Error("Configure the realtime session first");
	}
	if (session.stopping || session.closed) {
		throw new Error("Realtime session has stopped");
	}
	if (event.type === "ping") {
		send(session, { type: "pong" });
		return;
	}
	if (event.type === "stop") {
		await stopSession(session);
		session.socket.close(1000, "Interview stopped");
		return;
	}
	if (event.type === "chat_message") {
		const message = await addInterviewMessage(db, {
			interviewId: session.auth.interviewId,
			authorId: session.auth.userId,
			role: "user",
			content: event.content,
		});
		broadcast(session.auth.interviewId, {
			type: "chat_message",
			message: {
				id: message.id,
				role: message.role,
				content: message.content,
				createdAt: message.createdAt.toISOString(),
				sender: session.auth.displayName,
				authorId: session.auth.userId,
			},
		});
		return;
	}
	const notes = await saveInterviewNotes(db, {
		interviewId: session.auth.interviewId,
		content: event.content,
		updatedById: session.auth.userId,
	});
	broadcast(session.auth.interviewId, {
		type: "notes_update",
		content: notes.content,
		updatedAt: notes.updatedAt.toISOString(),
	});
}

async function handleBinary(session: Session, data: Uint8Array) {
	if (!session.auth || !session.config) {
		throw new Error("Configure the realtime session before sending audio");
	}
	if (!session.auth.canRecord) {
		throw new Error("You do not have permission to record this interview");
	}
	if (session.stopping || session.closed) {
		throw new Error("Realtime session has stopped");
	}
	if (!data.byteLength || data.byteLength > 65_536) {
		throw new Error("Invalid audio frame");
	}
	const durationMs = pcm16DurationMs(data);
	session.receivedAudioMs += durationMs;
	if (
		session.receivedAudioMs > maximumSessionMs ||
		session.receivedAudioMs > Date.now() - session.configuredAt + 5_000
	) {
		session.socket.close(1008, "Audio rate or duration limit exceeded");
		throw new Error("Audio rate or duration limit exceeded");
	}
	if (session.config.asrEngine === "aliyun") {
		await session.aliyun?.sendAudio(data);
		session.audioClockMs += durationMs;
		send(session, {
			type: "level",
			rms: pcm16Rms(data),
			durationMs: Math.round(durationMs),
		});
	} else {
		queueCloudAudio(session, data);
	}
}

const server = createServer((request, response) => {
	if (request.url === "/health") {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ ok: true }));
		return;
	}
	response.writeHead(404).end();
});

const websocketServer = new WebSocketServer({
	server,
	maxPayload: 131_072,
	verifyClient: ({ origin }, done) => {
		const accepted = Boolean(origin && allowedOrigins.has(origin));
		done(
			accepted,
			accepted ? 101 : 403,
			accepted ? undefined : "Origin denied",
		);
	},
});

websocketServer.on("connection", (socket) => {
	const session: Session = {
		socket,
		closed: false,
		stopping: false,
		configuredAt: 0,
		receivedAudioMs: 0,
		accessCheckInFlight: false,
		eventQueue: Promise.resolve(),
		audioClockMs: 0,
		cloudFlush: Promise.resolve(),
		partialTranslations: new Map(),
	};
	const configureTimeout = setTimeout(() => {
		if (!session.auth) {
			socket.close(1008, "Configuration timeout");
		}
	}, 10_000);

	socket.on("message", (raw, isBinary) => {
		session.eventQueue = session.eventQueue
			.then(() => {
				if (session.stopping || session.closed) {
					return;
				}
				return isBinary
					? handleBinary(session, new Uint8Array(raw as Buffer))
					: handleText(session, raw.toString());
			})
			.catch((error) => {
				if (session.stopping || session.closed) {
					return;
				}
				fail(
					session,
					"INVALID_EVENT",
					error instanceof Error
						? error.message
						: "Invalid realtime event",
				);
			});
	});
	socket.on("close", () => {
		clearTimeout(configureTimeout);
		void stopSession(session, false);
	});
	socket.on("error", () => {
		clearTimeout(configureTimeout);
		void stopSession(session, false);
	});
});

if (production && !process.env.INTERVIEW_ALLOWED_ORIGIN) {
	throw new Error("INTERVIEW_ALLOWED_ORIGIN is required in production");
}
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("INTERVIEW_REALTIME_PORT must be a valid port");
}
if (!Number.isFinite(maximumSessionMs) || maximumSessionMs <= 0) {
	throw new Error("INTERVIEW_MAX_SESSION_MINUTES must be a positive number");
}

server.listen(port, "127.0.0.1", () => {
	console.info(`Interview realtime gateway listening on :${port}`);
});

async function shutdown() {
	for (const session of [...rooms.values()].flatMap((value) => [...value])) {
		await stopSession(session, false);
	}
	websocketServer.close();
	server.close();
	await db.$disconnect();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

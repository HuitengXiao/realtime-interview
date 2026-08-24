"use client";

import { autoAgentTranscriptFingerprint } from "@repo/interview/auto-agent";
import { mergeSharedChatMessages } from "@repo/interview/chat-sync";
import {
	groupTranscriptSegmentsForDisplay,
	mergeRealtimeDisplaySegment,
} from "@repo/interview/display-segmentation";
import { resolveAgentMention } from "@repo/interview/mentions";
import { useSession } from "@saas/auth/hooks/use-session";
import { sidebarExpanded } from "@saas/shared/lib/state";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Textarea } from "@ui/components/textarea";
import { cn } from "@ui/lib";
import { useAtomValue } from "jotai";
import {
	ArrowLeftIcon,
	BotIcon,
	ChevronDownIcon,
	CircleStopIcon,
	MicIcon,
	PlayIcon,
	PlusIcon,
	RotateCcwIcon,
	SaveIcon,
	SendIcon,
	SettingsIcon,
	SparklesIcon,
	Trash2Icon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Segment = {
	id: string;
	text: string;
	translation?: string;
	isFinal?: boolean;
	speaker?: string;
	timestamp?: string;
	startMs?: number;
	endMs?: number;
	translationIsPartial?: boolean;
	translationSourceText?: string;
};
type ChatMessage = {
	id: string;
	content: string;
	sender?: string;
	createdAt?: string;
	role?: string;
	authorId?: string;
	agentId?: string;
};
type Member = {
	id?: string;
	userId?: string;
	name?: string;
	displayName?: string;
	email?: string;
	user?: {
		id?: string;
		name?: string;
		displayName?: string;
		email?: string;
	};
};

type AgentConfig = {
	id: string;
	name: string;
	model: string;
	prompt: string;
	includeTranscript: boolean;
	includeHistory: boolean;
};

type AutoAgentConfig = {
	enabled: boolean;
	model: string;
	prompt: string;
	debounceSeconds: number;
};

type AutoAgentOutput = {
	id: string;
	content: string;
	createdAt: string;
	trigger: "auto" | "manual";
};

const defaultAutoAgent: AutoAgentConfig = {
	enabled: false,
	model: "deepseek-v4-flash",
	prompt: "你是一个会议助手。请根据以下字幕内容，用中文生成：\n1. 关键摘要（3-5句）\n2. 行动项（如有）\n3. 需要跟进的问题（如有）\n格式简洁，分段清晰。",
	debounceSeconds: 4,
};

const defaultAgents: AgentConfig[] = [
	{
		id: "agent-default",
		name: "翻译",
		model: "deepseek-v4-flash",
		prompt: "你是一个简洁、可靠的实时对话助手。直接输出简洁通俗的翻译用户的输入。",
		includeTranscript: false,
		includeHistory: false,
	},
	{
		id: "agent-default1",
		name: "音标",
		model: "deepseek-v4-flash",
		prompt: "你是一个简洁、可靠的实时对话助手。你是一个专注、简洁的对话助手。请根据用户输入直接输出英文，和关键词的音标",
		includeTranscript: false,
		includeHistory: false,
	},
	{
		id: "agent-default2",
		name: "通用",
		model: "deepseek-v4-flash",
		prompt: "你是一个简洁、可靠的实时对话助手。回答用户问题，直接输出简洁通俗的回答。",
		includeTranscript: false,
		includeHistory: false,
	},
	{
		id: "agent-default3",
		name: "文化",
		model: "deepseek-v4-flash",
		prompt: "你是一个简洁、可靠的实时对话助手。回答用户关于文化的问题，300字内。",
		includeTranscript: false,
		includeHistory: false,
	},
];
const defaultAgent = defaultAgents[0] as AgentConfig;
const freshDefaultAgents = () => defaultAgents.map((agent) => ({ ...agent }));

type IdentityColorStyle = CSSProperties &
	Record<`--identity-${string}`, string>;

function stableIdentityHash(value: string) {
	let first = 0xdeadbeef;
	let second = 0x41c6ce57;
	for (let index = 0; index < value.length; index += 1) {
		const character = value.charCodeAt(index);
		first = Math.imul(first ^ character, 2654435761);
		second = Math.imul(second ^ character, 1597334677);
	}
	first =
		Math.imul(first ^ (first >>> 16), 2246822507) ^
		Math.imul(second ^ (second >>> 13), 3266489909);
	second =
		Math.imul(second ^ (second >>> 16), 2246822507) ^
		Math.imul(first ^ (first >>> 13), 3266489909);
	return 4294967296 * (2097151 & second) + (first >>> 0);
}

function hslLuminance(hue: number, saturation: number, lightness: number) {
	const s = saturation / 100;
	const l = lightness / 100;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const section = hue / 60;
	const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
	const [red, green, blue] =
		section < 1
			? [chroma, intermediate, 0]
			: section < 2
				? [intermediate, chroma, 0]
				: section < 3
					? [0, chroma, intermediate]
					: section < 4
						? [0, intermediate, chroma]
						: section < 5
							? [intermediate, 0, chroma]
							: [chroma, 0, intermediate];
	const offset = l - chroma / 2;
	return [red + offset, green + offset, blue + offset]
		.map((channel) =>
			channel <= 0.04045
				? channel / 12.92
				: ((channel + 0.055) / 1.055) ** 2.4,
		)
		.reduce(
			(total, channel, index) =>
				total + channel * ([0.2126, 0.7152, 0.0722][index] as number),
			0,
		);
}

function identityColorStyle(
	kind: "agent" | "user",
	identity: string,
): IdentityColorStyle {
	const hash = stableIdentityHash(`${kind}:${identity}`);
	const hue = hash % 360;
	const variant = Math.floor(hash / 360);
	const accentSaturation = (kind === "agent" ? 76 : 58) + (variant % 10);
	const darkAccentSaturation = accentSaturation - 8;
	const accentLightness = 44 + (Math.floor(variant / 10) % 5);
	const accentLuminance = hslLuminance(
		hue,
		accentSaturation,
		accentLightness,
	);
	const darkAccentLuminance = hslLuminance(
		hue,
		darkAccentSaturation,
		accentLightness,
	);
	const contrastForeground = (luminance: number) =>
		1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
			? "0 0% 100%"
			: "0 0% 0%";
	return {
		"--identity-soft": `${hue} ${kind === "agent" ? 88 : 62}% 95%`,
		"--identity-strong": `${hue} ${kind === "agent" ? 72 : 58}% 34%`,
		"--identity-accent": `${hue} ${accentSaturation}% ${accentLightness}%`,
		"--identity-accent-fg": contrastForeground(accentLuminance),
		"--identity-dark-soft": `${hue} ${kind === "agent" ? 38 : 28}% 18%`,
		"--identity-dark-strong": `${hue} ${kind === "agent" ? 82 : 62}% 76%`,
		"--identity-dark-accent": `${hue} ${darkAccentSaturation}% ${accentLightness}%`,
		"--identity-dark-accent-fg": contrastForeground(darkAccentLuminance),
	};
}

const identitySoftClass =
	"bg-[hsl(var(--identity-soft))] text-[hsl(var(--identity-strong))] dark:bg-[hsl(var(--identity-dark-soft))] dark:text-[hsl(var(--identity-dark-strong))]";
const identityAccentClass =
	"bg-[hsl(var(--identity-accent))] text-[hsl(var(--identity-accent-fg))] dark:bg-[hsl(var(--identity-dark-accent))] dark:text-[hsl(var(--identity-dark-accent-fg))]";
const identityTextClass =
	"text-[hsl(var(--identity-strong))] dark:text-[hsl(var(--identity-dark-strong))]";

function chatMessageColorStyle(message: ChatMessage, agents: AgentConfig[]) {
	if (message.role === "assistant") {
		const normalizedSender = message.sender?.replace(/^@/, "");
		const agentIndex = agents.findIndex(
			(agent) =>
				agent.id === message.agentId || agent.name === normalizedSender,
		);
		return identityColorStyle(
			"agent",
			message.agentId ??
				agents[agentIndex]?.id ??
				normalizedSender ??
				"agent",
		);
	}
	const sender = message.sender?.split(" → ")[0]?.trim() || "成员";
	return identityColorStyle("user", message.authorId ?? sender);
}

function normalizeAgents(value: unknown): AgentConfig[] {
	if (!Array.isArray(value)) {
		return freshDefaultAgents();
	}
	const agents = value
		.filter((item): item is Record<string, unknown> =>
			Boolean(item && typeof item === "object"),
		)
		.map((item, index) => ({
			id: String(item.id || `agent-migrated-${index}`),
			name: String(item.name || "助手").slice(0, 32),
			model: String(item.model || defaultAgent.model).slice(0, 120),
			prompt: String(item.prompt || defaultAgent.prompt).slice(0, 8_000),
			includeTranscript:
				item.includeTranscript === true ||
				item.include_context === true,
			includeHistory:
				item.includeHistory === true || item.include_context === true,
		}));
	return agents.length ? agents : freshDefaultAgents();
}

function normalizeAutoAgent(value: unknown): AutoAgentConfig {
	const input =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	const debounceSeconds = Number(input.debounceSeconds ?? 4);
	return {
		enabled: input.enabled === true || input.autoTrigger === true,
		model: String(input.model || defaultAutoAgent.model).slice(0, 120),
		prompt: String(input.prompt || defaultAutoAgent.prompt).slice(0, 8_000),
		debounceSeconds: Number.isFinite(debounceSeconds)
			? Math.min(30, Math.max(2, debounceSeconds))
			: 4,
	};
}

function numberOr(value: string, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSegment(value: unknown, index: number): Segment {
	const segment =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	const startMs = Number(segment.startMs ?? segment.start_ms);
	const endMs = Number(segment.endMs ?? segment.end_ms);
	return {
		id: String(
			segment.id ??
				segment.segmentId ??
				segment.segmentKey ??
				`loaded-${Number.isFinite(startMs) ? startMs : index}-${Number.isFinite(endMs) ? endMs : index}`,
		),
		text: String(segment.text ?? ""),
		translation:
			typeof segment.translation === "string"
				? segment.translation
				: undefined,
		isFinal:
			typeof (segment.isFinal ?? segment.final) === "boolean"
				? Boolean(segment.isFinal ?? segment.final)
				: undefined,
		speaker:
			typeof segment.speaker === "string" ? segment.speaker : undefined,
		timestamp:
			typeof segment.timestamp === "string"
				? segment.timestamp
				: undefined,
		startMs: Number.isFinite(startMs) ? startMs : undefined,
		endMs: Number.isFinite(endMs) ? endMs : undefined,
		translationIsPartial: segment.translationIsPartial === true,
		translationSourceText:
			typeof segment.translationSourceText === "string"
				? segment.translationSourceText
				: undefined,
	};
}

function normalizeChatMessage(value: unknown): ChatMessage | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const message = value as Record<string, unknown>;
	const metadata =
		message.metadata && typeof message.metadata === "object"
			? (message.metadata as Record<string, unknown>)
			: {};
	const author =
		message.author && typeof message.author === "object"
			? (message.author as Record<string, unknown>)
			: {};
	const role = String(message.role || "user");
	const agentName = String(
		metadata.agentName || metadata.agent_name || "Agent",
	);
	const agentId = metadata.agentId ?? metadata.agent_id;
	const authorId = message.authorId ?? message.author_id ?? author.id;
	const memberName = String(
		message.sender ||
			message.displayName ||
			author.name ||
			author.email ||
			"成员",
	);
	return {
		id: String(message.id || crypto.randomUUID()),
		content: String(message.content || ""),
		role,
		sender:
			role === "assistant"
				? `@${agentName}`
				: agentId
					? `${memberName} → @${agentName}`
					: memberName,
		createdAt: message.createdAt ? String(message.createdAt) : undefined,
		agentId: agentId ? String(agentId) : undefined,
		authorId: authorId ? String(authorId) : undefined,
	};
}

function websocketUrl(url: string) {
	if (url.startsWith("http://")) {
		return `ws://${url.slice(7)}`;
	}
	if (url.startsWith("https://")) {
		return `wss://${url.slice(8)}`;
	}
	return url;
}

function memberIdentity(member: Member) {
	const user = member.user;
	return {
		id: member.userId ?? user?.id ?? member.id,
		name:
			member.name ??
			member.displayName ??
			user?.name ??
			user?.displayName,
		email: member.email ?? user?.email,
	};
}

export function RealtimeInterviewStudio({
	interviewId,
	organizationSlug,
}: { interviewId: string; organizationSlug: string }) {
	const { user } = useSession();
	const isSidebarExpanded = useAtomValue(sidebarExpanded);
	const [title, setTitle] = useState("访谈");
	const [intervieweeName, setIntervieweeName] = useState<string | null>(null);
	const [segments, setSegments] = useState<Segment[]>([]);
	const [chat, setChat] = useState<ChatMessage[]>([]);
	const [notes, setNotes] = useState("");
	const [members, setMembers] = useState<Member[]>([]);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [organizationMembers, setOrganizationMembers] = useState<Member[]>(
		[],
	);
	const [owner, setOwner] = useState<Member | null>(null);
	const [isOwner, setIsOwner] = useState(false);
	const [status, setStatus] = useState<
		"idle" | "connecting" | "live" | "subscribed" | "stopped" | "error"
	>("idle");
	const [error, setError] = useState<string | null>(null);
	const [inputSource, setInputSource] = useState<
		"mic" | "system" | "mixed" | "file"
	>("mic");
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [sourceLang, setSourceLang] = useState("en");
	const [targetLang, setTargetLang] = useState("zh");
	const [asrEngine, setAsrEngine] = useState("aliyun");
	const [silence, setSilence] = useState("1");
	const [lineWidth, setLineWidth] = useState("100");
	const [translationInterval, setTranslationInterval] = useState("3");
	const [agents, setAgents] = useState<AgentConfig[]>(freshDefaultAgents);
	const [activeAgentId, setActiveAgentId] = useState(defaultAgent.id);
	const [autoAgent, setAutoAgent] =
		useState<AutoAgentConfig>(defaultAutoAgent);
	const [savedAutoAgent, setSavedAutoAgent] =
		useState<AutoAgentConfig>(defaultAutoAgent);
	const [autoAgentOutputs, setAutoAgentOutputs] = useState<AutoAgentOutput[]>(
		[],
	);
	const [autoAgentRunning, setAutoAgentRunning] = useState(false);
	const [autoAgentOpen, setAutoAgentOpen] = useState(false);
	const [chatInput, setChatInput] = useState("");
	const [mentionQuery, setMentionQuery] = useState<string | null>(null);
	const [mentionIndex, setMentionIndex] = useState(0);
	const [chatSending, setChatSending] = useState(false);
	const [agentInput, setAgentInput] = useState("");
	const [agentSending, setAgentSending] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState<
		"transcription" | "agents" | "ownership"
	>("transcription");
	const [settingsSaving, setSettingsSaving] = useState(false);
	const [selectedOwnerId, setSelectedOwnerId] = useState("");
	const [ownershipSaving, setOwnershipSaving] = useState(false);
	const [agentOpen, setAgentOpen] = useState(false);
	const [notesSaved, setNotesSaved] = useState(false);
	const [level, setLevel] = useState(0);
	const socketRef = useRef<WebSocket | null>(null);
	const streamsRef = useRef<MediaStream[]>([]);
	const audioContextRef = useRef<AudioContext | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);
	const sourcesRef = useRef<AudioNode[]>([]);
	const fileSourceRef = useRef<AudioBufferSourceNode | null>(null);
	const recordingRef = useRef(false);
	const ownerRef = useRef(false);
	const componentActiveRef = useRef(true);
	const subscriberRetryRef = useRef<number | null>(null);
	const subscribeRef = useRef<() => Promise<void>>(async () => {});
	const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
	const chatCursorRef = useRef<{ createdAt: string; id: string } | null>(
		null,
	);
	const autoAgentTimerRef = useRef<number | null>(null);
	const autoAgentRunningRef = useRef(false);
	const autoAgentRequestRef = useRef<AbortController | null>(null);
	const autoAgentRunTriggerRef = useRef<"auto" | "manual" | null>(null);
	const autoAgentSessionStartedRef = useRef(false);
	const autoAgentLastFingerprintRef = useRef("");
	const displaySegments = useMemo(
		() =>
			groupTranscriptSegmentsForDisplay(
				segments,
				Math.round(numberOr(lineWidth, 100)),
			),
		[segments, lineWidth],
	);

	const send = useCallback((data: unknown) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify(data));
		}
	}, []);

	const cleanupMedia = useCallback(() => {
		processorRef.current?.disconnect();
		sourcesRef.current.forEach((source) => source.disconnect());
		try {
			fileSourceRef.current?.stop();
		} catch {
			/* The file source may already have ended. */
		}
		streamsRef.current.forEach((stream) =>
			stream.getTracks().forEach((track) => track.stop()),
		);
		void audioContextRef.current?.close();
		processorRef.current = null;
		sourcesRef.current = [];
		fileSourceRef.current = null;
		streamsRef.current = [];
		audioContextRef.current = null;
		setLevel(0);
	}, []);

	const applyRealtimeEvent = useCallback(
		(data: Record<string, any>, socket: WebSocket) => {
			switch (data.type) {
				case "ready":
					if (data.member?.userId) {
						setCurrentUserId(String(data.member.userId));
					}
					break;
				case "segment": {
					const segment = data.segment ?? data;
					setSegments((current) => {
						const id = String(
							segment.id ??
								segment.segmentId ??
								segment.segmentKey ??
								"partial",
						);
						const index = current.findIndex(
							(item) => item.id === id,
						);
						const next = {
							id,
							text: segment.text ?? "",
							...(typeof segment.translation === "string"
								? {
										translation: segment.translation,
										translationIsPartial:
											segment.translationIsPartial ===
											true,
										translationSourceText:
											segment.translationSourceText,
									}
								: {}),
							isFinal: segment.isFinal ?? segment.final,
							speaker: segment.speaker,
							timestamp: segment.timestamp,
							startMs: segment.startMs,
							endMs: segment.endMs,
						};
						return index < 0
							? [...current, next]
							: current.map((item, itemIndex) =>
									itemIndex === index
										? mergeRealtimeDisplaySegment(
												item,
												next,
											)
										: item,
								);
					});
					break;
				}
				case "chat_message": {
					const message = normalizeChatMessage(data.message ?? data);
					if (message) {
						setChat((current) =>
							mergeSharedChatMessages(current, [message]),
						);
					}
					break;
				}
				case "notes_update":
					setNotes(
						data.content ?? data.notes?.content ?? data.notes ?? "",
					);
					break;
				case "members_update":
					setMembers(data.members ?? []);
					break;
				case "level":
					setLevel(Math.min(1, (data.rms ?? data.level ?? 0) * 5));
					break;
				case "stopped":
					cleanupMedia();
					socket.close();
					setStatus("stopped");
					break;
				case "error":
					setError(data.message ?? "实时服务发生错误");
					if (
						data.code === "ASR_FAILED" ||
						data.code === "INVALID_EVENT"
					) {
						cleanupMedia();
						socket.close();
						setStatus("error");
					}
			}
		},
		[cleanupMedia],
	);

	const stop = useCallback(() => {
		cleanupMedia();
		if (socketRef.current) {
			if (
				recordingRef.current &&
				socketRef.current.readyState === WebSocket.OPEN
			) {
				socketRef.current.send(JSON.stringify({ type: "stop" }));
			}
			socketRef.current.close();
			socketRef.current = null;
		}
		recordingRef.current = false;
		setStatus((current) => (current === "error" ? current : "stopped"));
	}, [cleanupMedia]);

	const subscribe = useCallback(async () => {
		if (
			ownerRef.current ||
			socketRef.current?.readyState === WebSocket.OPEN ||
			socketRef.current?.readyState === WebSocket.CONNECTING
		) {
			return;
		}
		try {
			const response = await fetch(
				`/api/interviews/${interviewId}/realtime-token`,
				{ method: "POST", credentials: "include" },
			);
			const data = await response.json().catch(() => ({}));
			if (!response.ok || !data.token || !data.realtimeUrl) {
				throw new Error(data.message || "无法订阅实时访谈更新");
			}
			const socket = new WebSocket(websocketUrl(data.realtimeUrl));
			socketRef.current = socket;
			socket.onopen = () => {
				if (subscriberRetryRef.current !== null) {
					window.clearTimeout(subscriberRetryRef.current);
					subscriberRetryRef.current = null;
				}
				socket.send(
					JSON.stringify({
						type: "configure",
						token: data.token,
						sourceLang: "auto",
						targetLang: "auto",
						asrEngine: "cloud",
						silenceMs: 1_000,
						lineWidth: 100,
						translationIntervalMs: 3_000,
					}),
				);
			};
			socket.onmessage = (event) => {
				try {
					const eventData = JSON.parse(event.data);
					if (eventData.type === "configured") {
						setError(null);
						setStatus("subscribed");
						return;
					}
					applyRealtimeEvent(eventData, socket);
				} catch {
					/* Ignore malformed realtime events. */
				}
			};
			socket.onerror = () => setError("实时更新订阅失败，正在重连");
			socket.onclose = () => {
				if (socketRef.current === socket) {
					socketRef.current = null;
				}
				if (componentActiveRef.current && !ownerRef.current) {
					setStatus("stopped");
					subscriberRetryRef.current = window.setTimeout(() => {
						void subscribeRef.current();
					}, 2_000);
				}
			};
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "无法订阅实时访谈更新",
			);
			if (componentActiveRef.current && !ownerRef.current) {
				subscriberRetryRef.current = window.setTimeout(() => {
					void subscribeRef.current();
				}, 2_000);
			}
		}
	}, [applyRealtimeEvent, interviewId]);
	subscribeRef.current = subscribe;

	useEffect(() => {
		componentActiveRef.current = true;
		const controller = new AbortController();
		void (async () => {
			try {
				const response = await fetch(`/api/interviews/${interviewId}`, {
					credentials: "include",
					signal: controller.signal,
				});
				if (!response.ok) {
					throw new Error("无法加载访谈资料");
				}
				const bundle = await response.json();
				setTitle(bundle.title ?? bundle.interview?.title ?? "访谈");
				setIntervieweeName(
					bundle.intervieweeName ??
						bundle.interview?.intervieweeName ??
						null,
				);
				const loadedSegments =
					bundle.segments ??
					bundle.transcript ??
					bundle.transcriptSegments ??
					[];
				setSegments(
					Array.isArray(loadedSegments)
						? loadedSegments.map(normalizeSegment)
						: [],
				);
				const loadedChat = (bundle.chat ?? bundle.messages ?? [])
					.map(normalizeChatMessage)
					.filter(Boolean) as ChatMessage[];
				setChat((current) =>
					mergeSharedChatMessages(current, loadedChat),
				);
				const latestChatMessage = loadedChat.at(-1);
				if (latestChatMessage?.createdAt) {
					chatCursorRef.current = {
						createdAt: latestChatMessage.createdAt,
						id: latestChatMessage.id,
					};
				}
				setNotes(bundle.notes?.content ?? bundle.notes ?? "");
				setMembers(bundle.members ?? []);
				setOrganizationMembers(bundle.organization?.members ?? []);
				setOwner(
					bundle.createdBy ?? bundle.interview?.createdBy ?? null,
				);
				ownerRef.current = bundle.permissions?.isOwner === true;
				setIsOwner(ownerRef.current);
				const roomSettings: Record<string, unknown> =
					bundle.settings && typeof bundle.settings === "object"
						? bundle.settings
						: {};
				setInputSource(
					["mic", "system", "mixed", "file"].includes(
						String(roomSettings.inputSource),
					)
						? (String(roomSettings.inputSource) as
								| "mic"
								| "system"
								| "mixed"
								| "file")
						: "mic",
				);
				setAsrEngine(
					["aliyun", "cloud"].includes(
						String(roomSettings.asrEngineSelect),
					)
						? String(roomSettings.asrEngineSelect)
						: "aliyun",
				);
				setSourceLang(
					["auto", "zh", "en"].includes(
						String(roomSettings.sourceLang),
					)
						? String(roomSettings.sourceLang)
						: ["auto", "zh", "en"].includes(bundle.sourceLang)
							? bundle.sourceLang
							: "en",
				);
				setTargetLang(
					["auto", "zh", "en"].includes(
						String(roomSettings.targetLang),
					)
						? String(roomSettings.targetLang)
						: ["auto", "zh", "en"].includes(bundle.targetLang)
							? bundle.targetLang
							: "zh",
				);
				setSilence(String(roomSettings.silence ?? 1));
				setLineWidth(String(roomSettings.lineWidth ?? 100));
				setTranslationInterval(
					String(roomSettings.translationInterval ?? 3),
				);
				const loadedAutoAgent = normalizeAutoAgent(
					roomSettings.autoAgent,
				);
				setAutoAgent(loadedAutoAgent);
				setSavedAutoAgent(loadedAutoAgent);
				const migratedAgents = normalizeAgents(roomSettings.agents);
				setAgents(migratedAgents);
				setActiveAgentId(
					migratedAgents.some(
						(agent) =>
							agent.id === String(roomSettings.activeAgentId),
					)
						? String(roomSettings.activeAgentId)
						: migratedAgents[0]?.id || defaultAgent.id,
				);
				if (bundle.permissions?.isOwner !== true) {
					void subscribe();
				}
			} catch (cause) {
				if (!controller.signal.aborted) {
					setError(
						cause instanceof Error
							? cause.message
							: "无法加载访谈资料",
					);
				}
			}
		})();
		return () => {
			componentActiveRef.current = false;
			if (subscriberRetryRef.current !== null) {
				window.clearTimeout(subscriberRetryRef.current);
				subscriberRetryRef.current = null;
			}
			controller.abort();
			stop();
		};
	}, [interviewId, stop, subscribe]);

	useEffect(() => {
		let active = true;
		let requestInFlight = false;
		const refreshSharedChat = async () => {
			if (
				!active ||
				requestInFlight ||
				document.visibilityState === "hidden"
			) {
				return;
			}
			requestInFlight = true;
			try {
				const cursor = chatCursorRef.current;
				const query = new URLSearchParams();
				if (cursor) {
					query.set("afterCreatedAt", cursor.createdAt);
					query.set("afterId", cursor.id);
				}
				const response = await fetch(
					`/api/interviews/${interviewId}/messages?${query}`,
					{ credentials: "include" },
				);
				if (!response.ok || !active) {
					return;
				}
				const messages = await response.json();
				if (active && Array.isArray(messages)) {
					const normalized = messages
						.map(normalizeChatMessage)
						.filter(Boolean) as ChatMessage[];
					setChat((current) =>
						mergeSharedChatMessages(current, normalized),
					);
					const latest = normalized.at(-1);
					if (latest?.createdAt) {
						chatCursorRef.current = {
							createdAt: latest.createdAt,
							id: latest.id,
						};
					}
				}
			} catch {
				/* Keep the latest local/realtime state during transient failures. */
			} finally {
				requestInFlight = false;
			}
		};
		const refreshWhenVisible = () => {
			if (document.visibilityState === "visible") {
				void refreshSharedChat();
			}
		};
		const timer = window.setInterval(() => {
			void refreshSharedChat();
		}, 2_000);
		document.addEventListener("visibilitychange", refreshWhenVisible);
		return () => {
			active = false;
			window.clearInterval(timer);
			document.removeEventListener(
				"visibilitychange",
				refreshWhenVisible,
			);
		};
	}, [interviewId]);

	useEffect(() => {
		const refreshOwnership = async () => {
			const response = await fetch(`/api/interviews/${interviewId}`, {
				credentials: "include",
			});
			if (!response.ok) {
				return;
			}
			const bundle = await response.json();
			const nextIsOwner = bundle.permissions?.isOwner === true;
			setOwner(bundle.createdBy ?? bundle.interview?.createdBy ?? null);
			if (!isOwner && nextIsOwner && socketRef.current) {
				ownerRef.current = true;
				stop();
			}
			if (isOwner && !nextIsOwner) {
				ownerRef.current = false;
				stop();
				void subscribe();
			}
			ownerRef.current = nextIsOwner;
			setIsOwner(nextIsOwner);
		};
		const timer = window.setInterval(() => {
			void refreshOwnership();
		}, 15_000);
		return () => window.clearInterval(timer);
	}, [interviewId, isOwner, stop, subscribe]);

	const start = async () => {
		if (!isOwner) {
			setError("只有房主可以开始实时录音");
			return;
		}
		setError(null);
		setStatus("connecting");
		try {
			const response = await fetch(
				`/api/interviews/${interviewId}/realtime-token`,
				{ method: "POST", credentials: "include" },
			);
			if (!response.ok) {
				throw new Error("无法获取实时访谈授权");
			}
			const { token, realtimeUrl, canRecord } = await response.json();
			if (!canRecord) {
				throw new Error("当前账号没有开始实时录音的权限");
			}
			recordingRef.current = true;
			const context = new AudioContext();
			await context.resume();
			const streams: MediaStream[] = [];
			const sources: AudioNode[] = [];
			let fileSource: AudioBufferSourceNode | null = null;
			audioContextRef.current = context;
			streamsRef.current = streams;
			sourcesRef.current = sources;

			if (inputSource === "mic" || inputSource === "mixed") {
				const microphone = await navigator.mediaDevices.getUserMedia({
					audio: { echoCancellation: true, noiseSuppression: true },
				});
				streams.push(microphone);
				sources.push(context.createMediaStreamSource(microphone));
			}
			if (inputSource === "system" || inputSource === "mixed") {
				const display = await navigator.mediaDevices.getDisplayMedia({
					video: true,
					audio: true,
				});
				if (!display.getAudioTracks().length) {
					display.getTracks().forEach((track) => track.stop());
					throw new Error(
						"没有捕获到系统声音，请在分享窗口中开启“共享音频”",
					);
				}
				streams.push(display);
				sources.push(context.createMediaStreamSource(display));
				display.getTracks().forEach((track) => {
					track.onended = () => stop();
				});
			}
			if (inputSource === "file") {
				if (!audioFile) {
					throw new Error("请先选择要转录的本地音频文件");
				}
				const buffer = await context.decodeAudioData(
					await audioFile.arrayBuffer(),
				);
				fileSource = context.createBufferSource();
				fileSource.buffer = buffer;
				fileSource.onended = () => stop();
				sources.push(fileSource);
				fileSourceRef.current = fileSource;
			}
			if (!sources.length) {
				throw new Error("没有可用的音频输入");
			}
			const processor = context.createScriptProcessor(4096, 1, 1);
			const socket = new WebSocket(websocketUrl(realtimeUrl));
			socket.binaryType = "arraybuffer";
			streamsRef.current = streams;
			audioContextRef.current = context;
			sourcesRef.current = sources;
			fileSourceRef.current = fileSource;
			processorRef.current = processor;
			socketRef.current = socket;
			let audioStarted = false;
			socket.onopen = () => {
				send({
					type: "configure",
					token,
					sourceLang,
					targetLang,
					asrEngine,
					silenceMs: Math.round(numberOr(silence, 1) * 1_000),
					lineWidth: Math.round(numberOr(lineWidth, 100)),
					translationIntervalMs: Math.round(
						numberOr(translationInterval, 3) * 1_000,
					),
				});
			};
			processor.onaudioprocess = (event) => {
				if (socket.readyState !== WebSocket.OPEN) {
					return;
				}
				const input = event.inputBuffer.getChannelData(0);
				const ratio = context.sampleRate / 16000;
				const length = Math.ceil(input.length / ratio);
				const pcm = new Int16Array(length);
				let sum = 0;
				for (let i = 0; i < length; i++) {
					const sample = Math.max(
						-1,
						Math.min(1, input[Math.floor(i * ratio)] ?? 0),
					);
					pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
					sum += sample * sample;
				}
				setLevel(Math.min(1, Math.sqrt(sum / Math.max(length, 1)) * 5));
				socket.send(pcm.buffer);
			};
			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type !== "configured") {
						applyRealtimeEvent(data, socket);
						return;
					}
					switch (data.type) {
						case "configured":
							if (!audioStarted) {
								sources.forEach((source) =>
									source.connect(processor),
								);
								processor.connect(context.destination);
								fileSource?.start();
								audioStarted = true;
							}
							autoAgentSessionStartedRef.current = true;
							autoAgentLastFingerprintRef.current =
								autoAgentTranscriptFingerprint(segments);
							setStatus("live");
							break;
						case "segment": {
							const segment = data.segment ?? data;
							setSegments((current) => {
								const id = String(
									segment.id ??
										segment.segmentId ??
										segment.segmentKey ??
										"partial",
								);
								const index = current.findIndex(
									(item) => item.id === id,
								);
								const next = {
									id,
									text: segment.text ?? "",
									...(typeof segment.translation === "string"
										? {
												translation:
													segment.translation,
												translationIsPartial:
													segment.translationIsPartial ===
													true,
												translationSourceText:
													segment.translationSourceText,
											}
										: {}),
									isFinal: segment.isFinal ?? segment.final,
									speaker: segment.speaker,
									timestamp: segment.timestamp,
									startMs: segment.startMs,
									endMs: segment.endMs,
								};
								return index < 0
									? [...current, next]
									: current.map((item, itemIndex) =>
											itemIndex === index
												? mergeRealtimeDisplaySegment(
														item,
														next,
													)
												: item,
										);
							});
							break;
						}
						case "chat_message":
							setChat((current) => {
								const message = normalizeChatMessage(
									data.message ?? data,
								);
								return message
									? mergeSharedChatMessages(current, [
											message,
										])
									: current;
							});
							break;
						case "notes_update":
							setNotes(
								data.content ??
									data.notes?.content ??
									data.notes ??
									"",
							);
							break;
						case "members_update":
							setMembers(data.members ?? []);
							break;
						case "level":
							setLevel(
								Math.min(1, (data.rms ?? data.level ?? 0) * 5),
							);
							break;
						case "stopped":
							cleanupMedia();
							socket.close();
							setStatus("stopped");
							break;
						case "error":
							setError(data.message ?? "实时服务发生错误");
							if (
								data.code === "ASR_FAILED" ||
								data.code === "INVALID_EVENT"
							) {
								cleanupMedia();
								socket.close();
								setStatus("error");
							}
							break;
					}
				} catch {
					/* Ignore malformed realtime events. */
				}
			};
			socket.onerror = () => {
				cleanupMedia();
				setError("实时连接失败");
				setStatus("error");
			};
			socket.onclose = (event) => {
				const wasActive = socketRef.current === socket;
				if (wasActive) {
					cleanupMedia();
					socketRef.current = null;
					if (event.code !== 1000) {
						setError(
							event.reason === "Realtime token expired"
								? "实时访谈授权已过期，请重新开始"
								: event.reason || "实时连接已中断",
						);
					}
				}
				setStatus((current) =>
					current === "live" || current === "connecting"
						? "stopped"
						: current,
				);
			};
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "无法启动音频输入",
			);
			setStatus("error");
			stop();
		}
	};

	const mentionCandidates =
		mentionQuery === null
			? []
			: agents.filter((agent) =>
					agent.name
						.toLowerCase()
						.startsWith(mentionQuery.toLowerCase()),
				);
	const insertMention = (agent: AgentConfig) => {
		setChatInput((current) => {
			const replacement = `@${agent.name} `;
			return /@[^\s@]*$/.test(current)
				? current.replace(/@[^\s@]*$/, replacement)
				: `${current.trimEnd()}${current.trim() ? " " : ""}${replacement}`;
		});
		setActiveAgentId(agent.id);
		setMentionQuery(null);
		setMentionIndex(0);
		window.setTimeout(() => chatInputRef.current?.focus(), 0);
	};
	const submitChat = async (event: React.FormEvent) => {
		event.preventDefault();
		const input = chatInput.trim();
		if (!input || chatSending || agentSending) {
			return;
		}
		let routed: ReturnType<typeof resolveAgentMention>;
		try {
			routed = resolveAgentMention(input, agents);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "无法识别 Agent");
			return;
		}
		if (routed.agent) {
			if (!routed.content) {
				setError(`请输入要向 @${routed.agent.name} 发送的问题`);
				return;
			}
			setChatInput("");
			setMentionQuery(null);
			setActiveAgentId(routed.agent.id);
			await requestAgent(routed.content, routed.agent.id);
			return;
		}
		setChatSending(true);
		setError(null);
		try {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				send({ type: "chat_message", content: routed.content });
			} else {
				const response = await fetch(
					`/api/interviews/${interviewId}/messages`,
					{
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ content: routed.content }),
					},
				);
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(data.message || "消息发送失败");
				}
				const message = normalizeChatMessage(data);
				if (message) {
					setChat((current) =>
						mergeSharedChatMessages(current, [message]),
					);
				}
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "消息发送失败");
			return;
		} finally {
			setChatSending(false);
		}
		setChatInput("");
		setMentionQuery(null);
	};
	const saveNotes = async (content = notes) => {
		try {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				send({ type: "notes_save", content });
			} else {
				const response = await fetch(
					`/api/interviews/${interviewId}/notes`,
					{
						method: "PUT",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ content }),
					},
				);
				if (!response.ok) {
					throw new Error("笔记保存失败");
				}
			}
			setNotesSaved(true);
			window.setTimeout(() => setNotesSaved(false), 1400);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "笔记保存失败");
		}
	};
	const collectRoomSettings = () => ({
		inputSource,
		asrEngineSelect: asrEngine,
		sourceLang,
		targetLang,
		translationEngine: "cloud",
		silence: numberOr(silence, 1),
		lineWidth: numberOr(lineWidth, 100),
		translationInterval: numberOr(translationInterval, 3),
		agents,
		activeAgentId,
		autoAgent,
	});
	const saveRoomSettings = async () => {
		setSettingsSaving(true);
		setError(null);
		try {
			const settings = collectRoomSettings();
			const response = await fetch(`/api/interviews/${interviewId}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					sourceLang,
					targetLang,
					translationEngine: "cloud",
					settings,
				}),
			});
			if (!response.ok) {
				throw new Error(
					response.status === 403
						? "只有房间创建者或组织管理员可以修改设置"
						: "保存设置失败",
				);
			}
			if (
				status === "live" &&
				!savedAutoAgent.enabled &&
				autoAgent.enabled
			) {
				autoAgentSessionStartedRef.current = true;
				autoAgentLastFingerprintRef.current =
					autoAgentTranscriptFingerprint(segments);
			}
			setSavedAutoAgent({ ...autoAgent });
			setSettingsOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "保存设置失败");
		} finally {
			setSettingsSaving(false);
		}
	};
	const restoreDefaults = () => {
		setInputSource("mic");
		setAudioFile(null);
		setAsrEngine("aliyun");
		setSourceLang("en");
		setTargetLang("zh");
		setSilence("1");
		setLineWidth("100");
		setTranslationInterval("3");
		setAgents(freshDefaultAgents());
		setActiveAgentId(defaultAgent.id);
		setAutoAgent(defaultAutoAgent);
	};
	const updateAgent = (
		agentId: string,
		field: keyof Omit<AgentConfig, "id">,
		value: string | boolean,
	) => {
		setAgents((current) =>
			current.map((agent) =>
				agent.id === agentId ? { ...agent, [field]: value } : agent,
			),
		);
	};
	const addAgent = () => {
		const id = crypto.randomUUID();
		setAgents((current) => [
			...current,
			{ ...defaultAgent, id, name: `助手 ${current.length + 1}` },
		]);
		setActiveAgentId(id);
	};
	const removeAgent = (agentId: string) => {
		setAgents((current) => {
			if (current.length === 1) {
				return current;
			}
			const next = current.filter((agent) => agent.id !== agentId);
			if (activeAgentId === agentId) {
				setActiveAgentId(next[0]?.id ?? defaultAgent.id);
			}
			return next;
		});
	};
	const requestAgent = async (message: string, agentId = activeAgentId) => {
		const selectedAgent =
			agents.find((agent) => agent.id === agentId) ?? agents[0];
		if (!message.trim() || !selectedAgent) {
			return;
		}
		setAgentSending(true);
		setError(null);
		const optimisticId = crypto.randomUUID();
		setChat((current) => [
			...current,
			{
				id: optimisticId,
				content: message.trim(),
				sender: `我 → @${selectedAgent.name}`,
				role: "user",
				authorId: user?.id ?? currentUserId ?? "self",
			},
		]);
		try {
			const response = await fetch(
				`/api/interviews/${interviewId}/agent`,
				{
					method: "POST",
					credentials: "include",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						message: message.trim(),
						includeTranscript: true,
						agentId: selectedAgent.id,
					}),
				},
			);
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.message || "Agent 暂时无法回复");
			}
			setChat((current) =>
				current.map((item) =>
					item.id === optimisticId && data.userMessageId
						? {
								...item,
								id: data.userMessageId,
								authorId: data.userId ?? item.authorId,
							}
						: item,
				),
			);
			setChat((current) =>
				mergeSharedChatMessages(current, [
					{
						id: data.assistantMessageId || crypto.randomUUID(),
						content: data.message,
						sender: `@${selectedAgent.name}`,
						role: "assistant",
						agentId: selectedAgent.id,
						createdAt: data.createdAt,
					},
				]),
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Agent 暂时无法回复",
			);
		} finally {
			setAgentSending(false);
		}
	};
	const askAgent = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!agentInput.trim()) {
			return;
		}
		const message = agentInput;
		setAgentInput("");
		await requestAgent(message);
	};
	const runAutoAgent = useCallback(
		async (trigger: "auto" | "manual" = "manual") => {
			if (autoAgentRunningRef.current) {
				return;
			}
			const fingerprint = autoAgentTranscriptFingerprint(segments);
			if (!fingerprint) {
				setError("暂无可供自主 Agent 分析的字幕");
				return;
			}
			autoAgentRunningRef.current = true;
			const controller = new AbortController();
			autoAgentRequestRef.current = controller;
			autoAgentRunTriggerRef.current = trigger;
			setAutoAgentRunning(true);
			setError(null);
			autoAgentLastFingerprintRef.current = fingerprint;
			try {
				const response = await fetch(
					`/api/interviews/${interviewId}/auto-agent`,
					{
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ trigger }),
						signal: controller.signal,
					},
				);
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(data.message || "自主 Agent 暂时无法运行");
				}
				setAutoAgentOutputs((current) => [
					...current,
					{
						id: crypto.randomUUID(),
						content: String(data.message || "（无内容）"),
						createdAt: data.createdAt || new Date().toISOString(),
						trigger,
					},
				]);
				setAutoAgentOpen(true);
			} catch (cause) {
				if (
					!(
						cause instanceof DOMException &&
						cause.name === "AbortError"
					)
				) {
					setError(
						cause instanceof Error
							? cause.message
							: "自主 Agent 暂时无法运行",
					);
				}
			} finally {
				if (autoAgentRequestRef.current === controller) {
					autoAgentRequestRef.current = null;
					autoAgentRunTriggerRef.current = null;
					autoAgentRunningRef.current = false;
					setAutoAgentRunning(false);
				}
			}
		},
		[interviewId, segments],
	);

	useEffect(() => {
		if (autoAgentTimerRef.current !== null) {
			window.clearTimeout(autoAgentTimerRef.current);
			autoAgentTimerRef.current = null;
		}
		if (!isOwner || !savedAutoAgent.enabled || status !== "live") {
			if (autoAgentRunTriggerRef.current === "auto") {
				autoAgentRequestRef.current?.abort();
			}
			autoAgentSessionStartedRef.current = false;
			return;
		}
		const fingerprint = autoAgentTranscriptFingerprint(segments);
		if (!autoAgentSessionStartedRef.current) {
			autoAgentSessionStartedRef.current = true;
			autoAgentLastFingerprintRef.current = fingerprint;
			return;
		}
		if (!fingerprint) {
			return;
		}
		if (
			fingerprint === autoAgentLastFingerprintRef.current ||
			autoAgentRunning
		) {
			return;
		}
		autoAgentTimerRef.current = window.setTimeout(() => {
			autoAgentTimerRef.current = null;
			void runAutoAgent("auto");
		}, savedAutoAgent.debounceSeconds * 1_000);
		return () => {
			if (autoAgentTimerRef.current !== null) {
				window.clearTimeout(autoAgentTimerRef.current);
				autoAgentTimerRef.current = null;
			}
		};
	}, [
		autoAgentRunning,
		isOwner,
		runAutoAgent,
		savedAutoAgent.debounceSeconds,
		savedAutoAgent.enabled,
		segments,
		status,
	]);
	useEffect(
		() => () => {
			autoAgentRequestRef.current?.abort();
		},
		[],
	);
	const transferOwnership = async () => {
		if (!selectedOwnerId || ownershipSaving) {
			return;
		}
		setOwnershipSaving(true);
		setError(null);
		try {
			const response = await fetch(
				`/api/interviews/${interviewId}/transfer-owner`,
				{
					method: "POST",
					credentials: "include",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ userId: selectedOwnerId }),
				},
			);
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.message || "转让房主失败");
			}
			stop();
			const nextOwner = organizationMembers.find(
				(member) => memberIdentity(member).id === selectedOwnerId,
			);
			const refreshed = await fetch(`/api/interviews/${interviewId}`, {
				credentials: "include",
			}).then((result) => (result.ok ? result.json() : null));
			setOwner(
				refreshed?.createdBy ??
					refreshed?.interview?.createdBy ??
					data.createdBy ??
					data.owner ??
					nextOwner ??
					null,
			);
			ownerRef.current = refreshed?.permissions?.isOwner === true;
			setIsOwner(ownerRef.current);
			setSettingsOpen(false);
			setSelectedOwnerId("");
			void subscribe();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "转让房主失败");
		} finally {
			setOwnershipSaving(false);
		}
	};

	const statusLabel =
		status === "live"
			? "正在记录"
			: status === "subscribed"
				? "实时订阅中"
				: status === "connecting"
					? "正在连接"
					: status === "stopped"
						? "已停止"
						: status === "error"
							? "连接异常"
							: "未连接";
	const inputSourceLabel = {
		mic: "麦克风",
		system: "系统声音",
		mixed: "混合输入",
		file: "本地文件",
	}[inputSource];

	return (
		<>
			<div
				className={cn(
					"relative left-1/2 flex min-h-[720px] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-primary/[.045] p-3 text-[#17211f] shadow-sm md:h-[calc(100vh-3rem)] md:transition-[width] md:duration-200 dark:bg-[#101513] dark:text-[#e9efec]",
					isSidebarExpanded
						? "md:w-[calc(100vw-312px)]"
						: "md:w-[calc(100vw-2rem)]",
				)}
			>
				{error && (
					<div className="mb-3 shrink-0 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
						{error}
					</div>
				)}

				<div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.9fr)_minmax(300px,.9fr)]">
					<section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#dde0da] bg-white shadow-[0_2px_12px_rgba(23,33,31,.06)] dark:border-white/10 dark:bg-[#171d1a]">
						<header className="flex min-h-16 flex-wrap items-center gap-2 border-[#dde0da] border-b bg-[#f8faf7]/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
							<Link
								href={`/app/${organizationSlug}/interviews`}
								className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dde0da] bg-white px-3 text-xs font-semibold transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5"
							>
								<ArrowLeftIcon className="size-4" />
								返回房间
							</Link>
							<div className="min-w-[108px] flex-1 px-1">
								<div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[#6b7874]">
									<span>Audio · {inputSourceLabel}</span>
									<span>{Math.round(level * 100)}%</span>
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-[#dde0da] dark:bg-white/10">
									<div
										className="h-full rounded-full bg-primary transition-[width]"
										style={{ width: `${level * 100}%` }}
									/>
								</div>
							</div>
							{isOwner && (
								<Button
									className="h-9 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
									onClick={
										status === "live" ||
										status === "connecting"
											? stop
											: start
									}
									disabled={status === "connecting"}
								>
									{status === "live" ? (
										<CircleStopIcon className="size-4" />
									) : (
										<MicIcon className="size-4" />
									)}
									{status === "live" ? "停止" : "开始"}
								</Button>
							)}
						</header>

						<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:thin]">
							{segments.length === 0 ? (
								<div className="grid flex-1 place-content-center gap-5 px-8 text-center text-sm text-[#6b7874]">
									<div className="mx-auto h-20 w-64 rounded-lg bg-[repeating-linear-gradient(90deg,transparent_0_9px,rgba(249,115,22,.25)_9px_11px,transparent_11px_20px),linear-gradient(180deg,#fff3e8,#fff)] [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_74%)]" />
									<div>
										<p className="font-semibold text-[#17211f] dark:text-[#e9efec]">
											实时识别结果会按时间显示
										</p>
										<p className="mt-1 text-xs">
											点击开始，访谈内容会在这里持续更新
										</p>
									</div>
								</div>
							) : (
								displaySegments.map((segment) => (
									<article
										key={segment.id}
										className={`group rounded-lg border border-[#e6e8e3] bg-[#fbfcfa] px-3.5 py-3 transition dark:border-white/10 dark:bg-white/[.035] ${segment.isFinal === false ? "opacity-55" : ""}`}
									>
										<div className="mb-1.5 flex items-center gap-2 text-[11px] text-[#6b7874]">
											<span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
												{(
													segment.speaker || "访"
												).slice(0, 1)}
											</span>
											<strong className="text-[#46524e] dark:text-[#bdc8c3]">
												{segment.speaker || "访谈成员"}
											</strong>
											<span>
												{segment.timestamp || "实时"}
											</span>
										</div>
										<p className="text-[15px] leading-7">
											{segment.text}
										</p>
										{segment.translation && (
											<div className="mt-2 border-primary/30 border-l-2 pl-3 text-primary">
												{segment.translationIsPartial && (
													<>
														<span className="mb-0.5 block text-[10px] opacity-70">
															临时译文 · 持续更新
														</span>
														{segment.translationSourceText &&
															segment.translationSourceText !==
																segment.text && (
																<p className="mb-1 text-[11px] opacity-60">
																	对应原文：
																	{
																		segment.translationSourceText
																	}
																</p>
															)}
													</>
												)}
												<p className="text-[13px] leading-6">
													{segment.translation}
												</p>
											</div>
										)}
									</article>
								))
							)}
						</div>
					</section>

					<section className="flex min-h-[460px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#dde0da] bg-white shadow-[0_2px_12px_rgba(23,33,31,.06)] dark:border-white/10 dark:bg-[#171d1a]">
						<header className="flex min-h-16 items-center justify-between gap-3 border-[#dde0da] border-b px-3.5 py-2 dark:border-white/10">
							<div className="min-w-0">
								<h1 className="truncate font-bold text-sm">
									{title}
								</h1>
								<div className="mt-1 flex items-center gap-2 text-[11px] text-[#6b7874]">
									<span
										className={`size-2 rounded-full ${status === "live" ? "animate-pulse bg-primary" : status === "error" ? "bg-red-500" : "bg-[#9aa5a1]"}`}
									/>
									<span>{statusLabel}</span>
									{intervieweeName && (
										<span>· {intervieweeName}</span>
									)}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								{isOwner && (
									<button
										type="button"
										onClick={() => setSettingsOpen(true)}
										className="grid size-8 place-items-center rounded-lg text-[#6b7874] transition hover:bg-primary/10 hover:text-primary"
										title="转译设置"
									>
										<SettingsIcon className="size-4" />
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										setNotes("");
										void saveNotes("");
									}}
									className="grid size-8 place-items-center rounded-lg text-[#6b7874] transition hover:bg-red-50 hover:text-red-600"
									title="清空笔记"
								>
									<Trash2Icon className="size-4" />
								</button>
							</div>
						</header>

						<div className="relative min-h-0 flex-1">
							<Textarea
								value={notes}
								onChange={(event) =>
									setNotes(event.target.value)
								}
								onBlur={() => void saveNotes()}
								placeholder="记录观察、追问和结论…\n\n这份笔记由房间成员共同维护。"
								className="h-full min-h-full resize-none rounded-none border-0 bg-transparent px-5 py-4 text-sm leading-7 shadow-none focus-visible:ring-0"
							/>
							<button
								type="button"
								onClick={() => void saveNotes()}
								className="absolute right-3 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dde0da] bg-white px-2.5 text-[11px] font-semibold text-[#6b7874] shadow-sm transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-[#202824]"
							>
								<SaveIcon className="size-3.5" />
								{notesSaved ? "已保存" : "保存"}
							</button>
						</div>

						<div className="shrink-0 border-[#dde0da] border-t dark:border-white/10">
							<div className="flex h-11 items-center gap-2 px-3">
								<button
									type="button"
									onClick={() =>
										setAutoAgentOpen((current) => !current)
									}
									className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-bold"
								>
									<SparklesIcon className="size-4 shrink-0 text-primary" />
									<span>自主 Agent</span>
									<span
										className={`size-1.5 rounded-full ${savedAutoAgent.enabled ? "bg-emerald-500" : "bg-[#9aa5a1]"}`}
									/>
									<span className="truncate text-[10px] font-normal text-muted-foreground">
										{savedAutoAgent.enabled
											? `静默 ${savedAutoAgent.debounceSeconds} 秒后分析`
											: "仅手动运行"}
									</span>
								</button>
								<button
									type="button"
									onClick={() => void runAutoAgent("manual")}
									disabled={
										autoAgentRunning ||
										segments.length === 0
									}
									className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2 text-[10px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
									title="立即分析最近 60 条字幕"
								>
									<PlayIcon
										className={`size-3 ${autoAgentRunning ? "animate-pulse" : ""}`}
									/>
									{autoAgentRunning ? "分析中" : "立即运行"}
								</button>
								<button
									type="button"
									onClick={() =>
										setAutoAgentOpen((current) => !current)
									}
									className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
									title="展开自主 Agent 输出"
								>
									<ChevronDownIcon
										className={`size-4 transition-transform ${autoAgentOpen ? "rotate-180" : ""}`}
									/>
								</button>
							</div>
							{autoAgentOpen && (
								<div className="max-h-64 space-y-2 overflow-y-auto border-[#dde0da] border-t bg-[#f8faf7]/60 p-3 [scrollbar-width:thin] dark:border-white/10 dark:bg-white/[.025]">
									{autoAgentOutputs.length === 0 ? (
										<p className="py-3 text-center text-[11px] leading-5 text-muted-foreground">
											自主 Agent
											将在这里写摘要、行动项和待跟进问题。
										</p>
									) : (
										autoAgentOutputs.map((output) => (
											<article
												key={output.id}
												className="rounded-xl border border-[#dde0da] bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#202824]"
											>
												<div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold text-muted-foreground">
													<span>
														{output.trigger ===
														"auto"
															? "自动分析"
															: "手动分析"}
													</span>
													<time>
														{new Date(
															output.createdAt,
														).toLocaleTimeString(
															"zh-CN",
															{
																hour: "2-digit",
																minute: "2-digit",
															},
														)}
													</time>
												</div>
												<div className="whitespace-pre-wrap text-[12px] leading-5">
													{output.content}
												</div>
											</article>
										))
									)}
								</div>
							)}
						</div>

						<div className="shrink-0 border-[#dde0da] border-t dark:border-white/10">
							<button
								type="button"
								onClick={() =>
									setAgentOpen((current) => !current)
								}
								className="flex h-11 w-full items-center justify-between px-4 text-xs font-bold hover:bg-[#f8faf7] dark:hover:bg-white/5"
							>
								<span className="flex items-center gap-2">
									<SparklesIcon className="size-4 text-primary" />
									Agent
								</span>
								<ChevronDownIcon
									className={`size-4 transition-transform ${agentOpen ? "rotate-180" : ""}`}
								/>
							</button>
							{agentOpen && (
								<div className="border-[#dde0da] border-t p-3 dark:border-white/10">
									<div className="mb-2 flex flex-wrap gap-1.5">
										{agents.map((agent) => (
											<button
												type="button"
												key={agent.id}
												onClick={() =>
													setActiveAgentId(agent.id)
												}
												style={identityColorStyle(
													"agent",
													agent.id,
												)}
												className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${activeAgentId === agent.id ? identityAccentClass : `${identitySoftClass} hover:brightness-95 dark:hover:brightness-110`}`}
											>
												@{agent.name}
											</button>
										))}
									</div>
									<form
										onSubmit={askAgent}
										className="flex gap-2"
									>
										<Input
											value={agentInput}
											onChange={(event) =>
												setAgentInput(
													event.target.value,
												)
											}
											placeholder={`向 @${agents.find((agent) => agent.id === activeAgentId)?.name ?? "助手"} 提问…`}
											className="h-9 text-xs"
										/>
										<Button
											type="submit"
											size="icon"
											className="size-9 bg-primary text-primary-foreground hover:bg-primary/90"
											disabled={
												agentSending ||
												!agentInput.trim()
											}
										>
											<BotIcon className="size-4" />
										</Button>
									</form>
								</div>
							)}
						</div>
					</section>

					<aside className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#dde0da] bg-white shadow-[0_2px_12px_rgba(23,33,31,.06)] dark:border-white/10 dark:bg-[#171d1a]">
						<header className="min-h-16 border-[#dde0da] border-b px-4 py-2.5 dark:border-white/10">
							<div className="flex items-center gap-2 font-bold text-sm">
								<UsersIcon className="size-4 text-primary" />
								房间群聊
							</div>
							<div className="mt-2 flex min-h-5 flex-wrap gap-1.5">
								{agents.map((agent) => (
									<button
										type="button"
										key={agent.id}
										onClick={() => insertMention(agent)}
										style={identityColorStyle(
											"agent",
											agent.id,
										)}
										className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-[10px] font-semibold transition ${activeAgentId === agent.id ? identityAccentClass : identitySoftClass}`}
									>
										<span
											className={`grid size-4 place-items-center rounded-full text-[8px] ${activeAgentId === agent.id ? "bg-white/20" : identityAccentClass}`}
										>
											{agent.name.slice(0, 1)}
										</span>
										@{agent.name}
									</button>
								))}
								{members.length ? (
									members.slice(0, 6).map((member, index) => {
										const identity = memberIdentity(member);
										const name =
											identity.name ??
											identity.email ??
											"成员";
										return (
											<span
												key={identity.id ?? index}
												style={identityColorStyle(
													"user",
													identity.id ?? name,
												)}
												className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-[10px] font-semibold ${identitySoftClass}`}
											>
												<span
													className={`grid size-4 place-items-center rounded-full text-[8px] ${identityAccentClass}`}
												>
													{name.slice(0, 1)}
												</span>
												{name}
											</span>
										);
									})
								) : agents.length === 0 ? (
									<span className="text-[11px] text-[#6b7874]">
										等待其他成员加入
									</span>
								) : null}
							</div>
						</header>

						<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:thin]">
							{chat.length === 0 ? (
								<div className="grid flex-1 place-content-center gap-2 text-center text-[#6b7874]">
									<BotIcon className="mx-auto size-7 opacity-40" />
									<p className="text-xs">还没有对话</p>
									<p className="text-[10px] opacity-70">
										输入 @名字 可以呼叫指定 Agent
									</p>
								</div>
							) : (
								chat.map((message, index) => {
									const colorStyle = chatMessageColorStyle(
										message,
										agents,
									);
									return (
										<div
											key={message.id ?? index}
											style={colorStyle}
											className="max-w-[92%] self-start"
										>
											<div
												className={`mb-1 px-1 text-[10px] font-semibold ${identityTextClass}`}
											>
												{message.sender ?? "成员"}
											</div>
											<div
												className={`rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] leading-5 ${identitySoftClass}`}
											>
												{message.content}
											</div>
										</div>
									);
								})
							)}
						</div>

						<form
							onSubmit={submitChat}
							className="relative flex shrink-0 items-end gap-2 border-[#dde0da] border-t p-3 dark:border-white/10"
						>
							{mentionQuery !== null &&
								mentionCandidates.length > 0 && (
									<div className="absolute right-3 bottom-[calc(100%+4px)] left-3 z-20 overflow-hidden rounded-xl border border-[#dde0da] bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#202824]">
										{mentionCandidates.map(
											(agent, index) => (
												<button
													type="button"
													key={agent.id}
													style={identityColorStyle(
														"agent",
														agent.id,
													)}
													onMouseDown={(event) =>
														event.preventDefault()
													}
													onClick={() =>
														insertMention(agent)
													}
													className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${index === mentionIndex ? identitySoftClass : "hover:bg-[#f8faf7] dark:hover:bg-white/5"}`}
												>
													<span
														className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${identityAccentClass}`}
													>
														{agent.name.slice(0, 1)}
													</span>
													@{agent.name}
												</button>
											),
										)}
									</div>
								)}
							<Textarea
								ref={chatInputRef}
								value={chatInput}
								onChange={(event) => {
									const value = event.target.value;
									setChatInput(value);
									const match = value.match(/@([^\s@]*)$/);
									setMentionQuery(match ? match[1] : null);
									setMentionIndex(0);
								}}
								onKeyDown={(event) => {
									if (
										mentionQuery !== null &&
										mentionCandidates.length
									) {
										if (event.key === "ArrowDown") {
											event.preventDefault();
											setMentionIndex(
												(current) =>
													(current + 1) %
													mentionCandidates.length,
											);
											return;
										}
										if (event.key === "ArrowUp") {
											event.preventDefault();
											setMentionIndex(
												(current) =>
													(current -
														1 +
														mentionCandidates.length) %
													mentionCandidates.length,
											);
											return;
										}
										if (
											event.key === "Enter" ||
											event.key === "Tab"
										) {
											event.preventDefault();
											const agent =
												mentionCandidates[mentionIndex];
											if (agent) {
												insertMention(agent);
											}
											return;
										}
										if (event.key === "Escape") {
											setMentionQuery(null);
											return;
										}
									}
									if (
										event.key === "Enter" &&
										!event.shiftKey &&
										!event.nativeEvent.isComposing
									) {
										event.preventDefault();
										event.currentTarget.form?.requestSubmit();
									}
								}}
								placeholder="发消息，输入 @ 呼叫 Agent…"
								className="min-h-10 resize-none rounded-xl text-xs"
								rows={2}
							/>
							<Button
								type="submit"
								size="icon"
								className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={
									chatSending ||
									agentSending ||
									!chatInput.trim()
								}
							>
								<SendIcon className="size-4" />
							</Button>
						</form>
					</aside>
				</div>
			</div>

			{settingsOpen && (
				<div
					className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]"
					role="presentation"
					onMouseDown={() => setSettingsOpen(false)}
				>
					<dialog
						open
						className="relative m-0 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#dde0da] bg-white shadow-2xl dark:border-white/10 dark:bg-[#171d1a]"
						aria-label="访谈设置"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<header className="flex flex-wrap items-center justify-between gap-4 border-[#dde0da] border-b px-5 py-4 dark:border-white/10">
							<div className="flex items-center gap-6">
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
										Preferences
									</p>
									<h2 className="mt-1 font-bold">访谈设置</h2>
								</div>
								<nav
									className="flex rounded-lg bg-muted/60 p-1"
									aria-label="设置分类"
								>
									<button
										type="button"
										onClick={() =>
											setSettingsTab("transcription")
										}
										className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${settingsTab === "transcription" ? "bg-white text-primary shadow-sm dark:bg-white/10" : "text-muted-foreground"}`}
									>
										转译配置
									</button>
									<button
										type="button"
										onClick={() => setSettingsTab("agents")}
										className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${settingsTab === "agents" ? "bg-white text-primary shadow-sm dark:bg-white/10" : "text-muted-foreground"}`}
									>
										Agent 设置{" "}
										<span className="ml-1 opacity-60">
											{agents.length}
										</span>
									</button>
									<button
										type="button"
										onClick={() =>
											setSettingsTab("ownership")
										}
										className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${settingsTab === "ownership" ? "bg-white text-primary shadow-sm dark:bg-white/10" : "text-muted-foreground"}`}
									>
										房主权限
									</button>
								</nav>
							</div>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={restoreDefaults}
									disabled={
										status === "live" || settingsSaving
									}
								>
									<RotateCcwIcon className="size-4" />{" "}
									恢复默认
								</Button>
								<Button
									size="sm"
									onClick={() => void saveRoomSettings()}
									loading={settingsSaving}
									className="bg-primary text-primary-foreground hover:bg-primary/90"
								>
									保存设置
								</Button>
							</div>
						</header>
						<div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5">
							{settingsTab === "transcription" ? (
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									<label className="grid gap-2 text-xs font-bold text-[#6b7874] sm:col-span-2 lg:col-span-3">
										输入来源
										<select
											value={inputSource}
											onChange={(event) => {
												setInputSource(
													event.target
														.value as typeof inputSource,
												);
												setAudioFile(null);
											}}
											disabled={status === "live"}
											className="h-11 rounded-lg border border-[#dde0da] bg-white px-3 text-sm font-normal text-[#17211f] dark:border-white/10 dark:bg-[#202824] dark:text-white"
										>
											<option value="mic">麦克风</option>
											<option value="system">
												系统/标签页声音
											</option>
											<option value="mixed">
												麦克风 + 系统/标签页
											</option>
											<option value="file">
												本地音频文件
											</option>
										</select>
									</label>
									{inputSource === "file" && (
										<label
											htmlFor="interview-audio-file"
											className="grid gap-2 text-xs font-bold text-[#6b7874] sm:col-span-2 lg:col-span-3"
										>
											音频文件
											<Input
												id="interview-audio-file"
												type="file"
												accept="audio/*,video/mp4,video/webm"
												disabled={status === "live"}
												onChange={(event) =>
													setAudioFile(
														event.target
															.files?.[0] ?? null,
													)
												}
											/>
											<span className="font-normal text-[11px]">
												{audioFile
													? `已选择：${audioFile.name}`
													: "每次打开房间需重新选择本地文件，文件不会上传保存。"}
											</span>
										</label>
									)}
									<label className="grid gap-2 text-xs font-bold text-[#6b7874] sm:col-span-2 lg:col-span-3">
										识别引擎
										<select
											value={asrEngine}
											onChange={(event) =>
												setAsrEngine(event.target.value)
											}
											disabled={status === "live"}
											className="h-11 rounded-lg border border-[#dde0da] bg-white px-3 text-sm font-normal text-[#17211f] dark:border-white/10 dark:bg-[#202824] dark:text-white"
										>
											<option value="aliyun">
												阿里云实时 ASR
											</option>
											<option value="cloud">
												OpenAI-compatible 云端 ASR
											</option>
										</select>
									</label>
									<label className="grid gap-2 text-xs font-bold text-[#6b7874]">
										源语言
										<select
											value={sourceLang}
											onChange={(event) =>
												setSourceLang(
													event.target.value,
												)
											}
											disabled={status === "live"}
											className="h-11 rounded-lg border border-[#dde0da] bg-white px-3 text-sm font-normal text-[#17211f] dark:border-white/10 dark:bg-[#202824] dark:text-white"
										>
											<option value="auto">自动</option>
											<option value="zh">中文</option>
											<option value="en">English</option>
										</select>
									</label>
									<label className="grid gap-2 text-xs font-bold text-[#6b7874]">
										翻译为
										<select
											value={targetLang}
											onChange={(event) =>
												setTargetLang(
													event.target.value,
												)
											}
											disabled={status === "live"}
											className="h-11 rounded-lg border border-[#dde0da] bg-white px-3 text-sm font-normal text-[#17211f] dark:border-white/10 dark:bg-[#202824] dark:text-white"
										>
											<option value="auto">
												自动互译
											</option>
											<option value="en">English</option>
											<option value="zh">中文</option>
										</select>
									</label>
									<label
										htmlFor="interview-silence"
										className="grid gap-2 text-xs font-bold text-[#6b7874]"
									>
										静音切句（秒）
										<Input
											id="interview-silence"
											type="number"
											min="0.2"
											max="10"
											step="0.1"
											value={silence}
											onChange={(event) =>
												setSilence(event.target.value)
											}
											disabled={status === "live"}
										/>
									</label>
									<label
										htmlFor="interview-line-width"
										className="grid gap-2 text-xs font-bold text-[#6b7874]"
									>
										每张字幕卡最大词数/字数
										<Input
											id="interview-line-width"
											type="number"
											min="6"
											max="1000"
											value={lineWidth}
											onChange={(event) =>
												setLineWidth(event.target.value)
											}
											disabled={status === "live"}
										/>
									</label>
									<label
										htmlFor="interview-translation-interval"
										className="grid gap-2 text-xs font-bold text-[#6b7874]"
									>
										讲话中自动翻译间隔（秒）
										<Input
											id="interview-translation-interval"
											type="number"
											min="1"
											max="30"
											step="1"
											value={translationInterval}
											onChange={(event) =>
												setTranslationInterval(
													event.target.value,
												)
											}
											disabled={status === "live"}
										/>
									</label>
									<p className="text-[11px] leading-5 text-[#6b7874] sm:col-span-2 lg:col-span-3">
										连续同说话人的短句会合并到词数/字数上限；持续讲话时按翻译间隔更新临时译文，停顿后再更新最终译文。录音开始后配置锁定。
									</p>
								</div>
							) : settingsTab === "ownership" ? (
								<div className="mx-auto max-w-xl space-y-5 py-4">
									<div>
										<h3 className="font-semibold">
											当前房主
										</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											{owner
												? (memberIdentity(owner).name ??
													memberIdentity(owner)
														.email ??
													"未知成员")
												: "未加载"}
										</p>
									</div>
									<label className="grid gap-2 text-xs font-bold text-[#6b7874]">
										转让给组织成员
										<select
											value={selectedOwnerId}
											onChange={(event) =>
												setSelectedOwnerId(
													event.target.value,
												)
											}
											className="h-11 rounded-lg border border-[#dde0da] bg-white px-3 text-sm font-normal text-[#17211f] dark:border-white/10 dark:bg-[#202824] dark:text-white"
										>
											<option value="">
												请选择新房主
											</option>
											{organizationMembers.map(
												(member, index) => {
													const identity =
														memberIdentity(member);
													const ownerId = owner
														? memberIdentity(owner)
																.id
														: undefined;
													return identity.id &&
														identity.id !==
															ownerId ? (
														<option
															key={
																identity.id ??
																index
															}
															value={identity.id}
														>
															{identity.name ??
																identity.email ??
																"成员"}
														</option>
													) : null;
												},
											)}
										</select>
									</label>
									<p className="text-xs leading-5 text-muted-foreground">
										转让后，你将立即失去房主权限，设置窗口会关闭。
									</p>
									<Button
										type="button"
										onClick={() => void transferOwnership()}
										loading={ownershipSaving}
										disabled={!selectedOwnerId}
										className="bg-primary text-primary-foreground hover:bg-primary/90"
									>
										确认转让
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									<section className="rounded-xl border border-primary/25 bg-primary/[.035] p-4">
										<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
											<div>
												<h3 className="flex items-center gap-2 font-semibold">
													<SparklesIcon className="size-4 text-primary" />
													自主 Agent
												</h3>
												<p className="mt-1 text-xs leading-5 text-muted-foreground">
													持续观察实时字幕，在一段话结束后主动生成摘要、行动项和待跟进问题。
												</p>
											</div>
											<label className="flex items-center gap-2 text-xs font-semibold">
												<input
													type="checkbox"
													checked={autoAgent.enabled}
													onChange={(event) =>
														setAutoAgent(
															(current) => ({
																...current,
																enabled:
																	event.target
																		.checked,
															}),
														)
													}
													className="size-4 accent-primary"
												/>
												自动运行
											</label>
										</div>
										<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
											<label
												htmlFor="auto-agent-model"
												className="grid gap-1.5 text-xs font-semibold text-muted-foreground"
											>
												模型
												<Input
													id="auto-agent-model"
													value={autoAgent.model}
													maxLength={120}
													onChange={(event) =>
														setAutoAgent(
															(current) => ({
																...current,
																model: event
																	.target
																	.value,
															}),
														)
													}
												/>
											</label>
											<label
												htmlFor="auto-agent-debounce"
												className="grid gap-1.5 text-xs font-semibold text-muted-foreground"
											>
												静默触发（秒）
												<Input
													id="auto-agent-debounce"
													type="number"
													min={2}
													max={30}
													step={1}
													value={
														autoAgent.debounceSeconds
													}
													onChange={(event) =>
														setAutoAgent(
															(current) => ({
																...current,
																debounceSeconds:
																	Math.min(
																		30,
																		Math.max(
																			2,
																			Number(
																				event
																					.target
																					.value,
																			) ||
																				4,
																		),
																	),
															}),
														)
													}
												/>
											</label>
											<label
												htmlFor="auto-agent-prompt"
												className="grid gap-1.5 text-xs font-semibold text-muted-foreground sm:col-span-2"
											>
												Prompt
												<Textarea
													id="auto-agent-prompt"
													value={autoAgent.prompt}
													rows={5}
													maxLength={8_000}
													className="resize-y text-xs leading-5"
													onChange={(event) =>
														setAutoAgent(
															(current) => ({
																...current,
																prompt: event
																	.target
																	.value,
															}),
														)
													}
												/>
											</label>
										</div>
									</section>
									<div className="flex items-center justify-between gap-4">
										<div>
											<h3 className="font-semibold">
												房间 Agents
											</h3>
											<p className="mt-1 text-xs text-muted-foreground">
												姓名、模型、Prompt
												和上下文开关均从 FunASR
												房间设置迁移。
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={addAgent}
											disabled={agents.length >= 12}
										>
											<PlusIcon className="size-4" /> 新增
											Agent
										</Button>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										{agents.map((agent) => (
											<article
												key={agent.id}
												className={`rounded-xl border p-4 transition ${activeAgentId === agent.id ? "border-primary bg-primary/[.035]" : "border-[#dde0da]"}`}
											>
												<div className="mb-3 flex items-center justify-between gap-2">
													<button
														type="button"
														onClick={() =>
															setActiveAgentId(
																agent.id,
															)
														}
														className="flex items-center gap-2 text-left font-semibold"
													>
														<span className="grid size-8 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
															{agent.name.slice(
																0,
																1,
															)}
														</span>
														<span>
															{activeAgentId ===
															agent.id
																? "默认 Agent"
																: "设为默认"}
														</span>
													</button>
													<button
														type="button"
														onClick={() =>
															removeAgent(
																agent.id,
															)
														}
														disabled={
															agents.length === 1
														}
														className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
														title="删除 Agent"
													>
														<Trash2Icon className="size-4" />
													</button>
												</div>
												<div className="grid gap-3 sm:grid-cols-2">
													<label
														htmlFor={`agent-name-${agent.id}`}
														className="grid gap-1.5 text-xs font-semibold text-muted-foreground"
													>
														姓名
														<Input
															id={`agent-name-${agent.id}`}
															value={agent.name}
															maxLength={32}
															onChange={(event) =>
																updateAgent(
																	agent.id,
																	"name",
																	event.target
																		.value,
																)
															}
														/>
													</label>
													<label
														htmlFor={`agent-model-${agent.id}`}
														className="grid gap-1.5 text-xs font-semibold text-muted-foreground"
													>
														模型
														<Input
															id={`agent-model-${agent.id}`}
															value={agent.model}
															maxLength={120}
															onChange={(event) =>
																updateAgent(
																	agent.id,
																	"model",
																	event.target
																		.value,
																)
															}
														/>
													</label>
													<label
														htmlFor={`agent-prompt-${agent.id}`}
														className="grid gap-1.5 text-xs font-semibold text-muted-foreground sm:col-span-2"
													>
														Prompt
														<Textarea
															id={`agent-prompt-${agent.id}`}
															value={agent.prompt}
															rows={5}
															className="resize-y text-xs leading-5"
															onChange={(event) =>
																updateAgent(
																	agent.id,
																	"prompt",
																	event.target
																		.value,
																)
															}
														/>
													</label>
												</div>
												<div className="mt-3 flex flex-wrap gap-4 text-xs">
													<label className="flex items-center gap-2">
														<input
															type="checkbox"
															checked={
																agent.includeTranscript
															}
															onChange={(event) =>
																updateAgent(
																	agent.id,
																	"includeTranscript",
																	event.target
																		.checked,
																)
															}
															className="size-4 accent-primary"
														/>
														带字幕上下文
													</label>
													<label className="flex items-center gap-2">
														<input
															type="checkbox"
															checked={
																agent.includeHistory
															}
															onChange={(event) =>
																updateAgent(
																	agent.id,
																	"includeHistory",
																	event.target
																		.checked,
																)
															}
															className="size-4 accent-primary"
														/>
														带群聊历史
													</label>
												</div>
											</article>
										))}
									</div>
								</div>
							)}
						</div>
					</dialog>
				</div>
			)}
		</>
	);
}

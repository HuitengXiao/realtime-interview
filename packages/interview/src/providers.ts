import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { pcm16DurationMs, pcm16ToWav } from "./audio";
import type { ChatMessage, TranscriptSegment } from "./types";

type Env = NodeJS.ProcessEnv;
const value = (env: Env, ...names: string[]) =>
	names.map((name) => env[name]?.trim()).find(Boolean) ?? "";
const numberValue = (env: Env, name: string, fallback: number) => {
	const parsed = Number(env[name]);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const boolValue = (env: Env, name: string, fallback: boolean) =>
	env[name] === undefined
		? fallback
		: ["1", "true", "yes", "on"].includes(env[name].toLowerCase());
const languageHints = (input: string) =>
	input
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);

export interface AliyunSettings {
	apiKey: string;
	workspaceId: string;
	region: string;
	endpoint: string;
	model: string;
	languageHints: string[];
	format: string;
	sampleRate: number;
	maxSentenceSilence: number;
	semanticPunctuationEnabled: boolean;
	heartbeat: boolean;
	timeoutMs: number;
}
export function aliyunSettings(env: Env = process.env): AliyunSettings {
	const workspaceId = value(env, "ALIYUN_ASR_WORKSPACE_ID");
	const region = value(env, "ALIYUN_ASR_REGION") || "cn-beijing";
	return {
		apiKey: value(env, "DASHSCOPE_API_KEY", "ALIYUN_API_KEY"),
		workspaceId,
		region,
		endpoint:
			value(env, "ALIYUN_ASR_ENDPOINT") ||
			(workspaceId
				? `wss://${workspaceId}.${region}.maas.aliyuncs.com/api-ws/v1/inference`
				: "wss://dashscope.aliyuncs.com/api-ws/v1/inference"),
		model: value(env, "ALIYUN_ASR_MODEL") || "paraformer-realtime-v2",
		languageHints: languageHints(
			value(env, "ALIYUN_ASR_LANGUAGE_HINTS") || "zh,en",
		),
		format: value(env, "ALIYUN_ASR_FORMAT") || "pcm",
		sampleRate: numberValue(env, "ALIYUN_ASR_SAMPLE_RATE", 16_000),
		maxSentenceSilence: numberValue(
			env,
			"ALIYUN_ASR_MAX_SENTENCE_SILENCE",
			800,
		),
		semanticPunctuationEnabled: boolValue(
			env,
			"ALIYUN_ASR_SEMANTIC_PUNCTUATION",
			false,
		),
		heartbeat: boolValue(env, "ALIYUN_ASR_HEARTBEAT", true),
		timeoutMs: numberValue(env, "ALIYUN_ASR_CONNECT_TIMEOUT", 15) * 1000,
	};
}

export interface StreamingSocket {
	send(data: string | Uint8Array): Promise<void> | void;
	receive(): Promise<string | Uint8Array>;
	close(): Promise<void> | void;
}
export type StreamingSocketFactory = (
	url: string,
	headers: Record<string, string>,
	timeoutMs?: number,
) => Promise<StreamingSocket>;
export interface StreamingTranscriptEvent {
	segment: TranscriptSegment;
	isFinal: boolean;
	billedDurationSeconds?: number;
}

export const nodeStreamingSocketFactory: StreamingSocketFactory = async (
	url,
	headers,
	timeoutMs = 15_000,
) => {
	const socket = new WebSocket(url, { headers, handshakeTimeout: timeoutMs });
	const messages: Array<string | Uint8Array> = [];
	const pending: Array<{
		resolve: (value: string | Uint8Array) => void;
		reject: (error: Error) => void;
	}> = [];
	let failure: Error | undefined;
	let closed = false;
	socket.on("message", (data: WebSocket.RawData) => {
		const message =
			typeof data === "string"
				? data
				: new Uint8Array(data as ArrayBuffer | Buffer);
		const waiter = pending.shift();
		if (waiter) {
			waiter.resolve(message);
		} else {
			messages.push(message);
		}
	});
	socket.on("error", (error) => {
		failure = error;
		while (pending.length) {
			pending.shift()?.reject(error);
		}
	});
	socket.on("close", () => {
		closed = true;
		failure ??= new Error("Upstream ASR socket closed");
		while (pending.length) {
			pending.shift()?.reject(failure);
		}
	});
	await new Promise<void>((resolve, reject) => {
		socket.once("open", resolve);
		socket.once("error", reject);
	});
	return {
		send: (data) =>
			new Promise<void>((resolve, reject) =>
				socket.send(data, (error) =>
					error ? reject(error) : resolve(),
				),
			),
		receive: () => {
			if (failure) {
				return Promise.reject(failure);
			}
			const message = messages.shift();
			if (message) {
				return Promise.resolve(message);
			}
			return new Promise((resolve, reject) => {
				if (failure) {
					reject(failure);
				} else {
					pending.push({ resolve, reject });
				}
			});
		},
		close: () =>
			new Promise<void>((resolve) => {
				if (closed || socket.readyState === WebSocket.CLOSED) {
					resolve();
					return;
				}
				socket.once("close", () => resolve());
				socket.close();
				setTimeout(() => {
					socket.terminate();
					resolve();
				}, 2_000).unref();
			}),
	};
};

export class AliyunParaformerStream {
	private socket?: StreamingSocket;
	private finished = false;
	readonly taskId = randomUUID();
	constructor(
		private readonly settings: AliyunSettings,
		private readonly sourceLanguage = "auto",
		private readonly socketFactory?: StreamingSocketFactory,
	) {}
	async start() {
		if (!this.settings.apiKey) {
			throw new Error("Aliyun ASR is not configured");
		}
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.settings.apiKey}`,
			"user-agent": "user-interview/1.0",
		};
		if (this.settings.workspaceId) {
			headers["X-DashScope-WorkSpace"] = this.settings.workspaceId;
		}
		this.socket = await (this.socketFactory ?? nodeStreamingSocketFactory)(
			this.settings.endpoint,
			headers,
			this.settings.timeoutMs,
		);
		await this.socket.send(
			JSON.stringify({
				header: {
					action: "run-task",
					task_id: this.taskId,
					streaming: "duplex",
				},
				payload: {
					task_group: "audio",
					task: "asr",
					function: "recognition",
					model: this.settings.model,
					parameters: {
						format: this.settings.format,
						sample_rate: this.settings.sampleRate,
						language_hints:
							this.sourceLanguage === "auto"
								? this.settings.languageHints
								: [this.sourceLanguage],
						semantic_punctuation_enabled:
							this.settings.semanticPunctuationEnabled,
						max_sentence_silence: this.settings.maxSentenceSilence,
						punctuation_prediction_enabled: true,
						inverse_text_normalization_enabled: true,
						heartbeat: this.settings.heartbeat,
					},
					input: {},
				},
			}),
		);
		while (true) {
			const message = this.message(await this.socket.receive());
			const event = message.header?.event;
			if (event === "task-started") {
				return;
			}
			if (event === "task-failed") {
				throw this.failure(message);
			}
		}
	}
	async sendAudio(pcm: Uint8Array) {
		if (!this.socket || this.finished) {
			throw new Error("Aliyun stream is not active");
		}
		await this.socket.send(pcm);
	}
	async receiveEvent(): Promise<StreamingTranscriptEvent | null> {
		if (!this.socket || this.finished) {
			return null;
		}
		while (true) {
			const message = this.message(await this.socket.receive());
			const event = message.header?.event;
			if (event === "task-finished") {
				this.finished = true;
				return null;
			}
			if (event === "task-failed") {
				this.finished = true;
				throw this.failure(message);
			}
			if (event !== "result-generated") {
				continue;
			}
			const sentence = message.payload?.output?.sentence ?? {};
			if (sentence.heartbeat || !String(sentence.text ?? "").trim()) {
				continue;
			}
			const begin = this.integer(sentence.begin_time, 0);
			let end = this.integer(sentence.end_time, begin);
			if (end <= begin) {
				end = begin + 250;
			}
			return {
				segment: {
					segmentKey: `aliyun-${this.taskId.slice(0, 8)}-${begin}`,
					speaker: "S?",
					startMs: begin,
					endMs: end,
					text: String(sentence.text).trim(),
					language: this.sourceLanguage,
				},
				isFinal: Boolean(sentence.sentence_end),
				billedDurationSeconds: this.optionalInteger(
					message.payload?.usage?.duration,
				),
			};
		}
	}
	async finish() {
		if (this.socket && !this.finished) {
			await this.socket.send(
				JSON.stringify({
					header: {
						action: "finish-task",
						task_id: this.taskId,
						streaming: "duplex",
					},
					payload: { input: {} },
				}),
			);
		}
	}
	async close() {
		if (this.socket) {
			await this.socket.close();
		}
		this.socket = undefined;
		this.finished = true;
	}
	private message(raw: string | Uint8Array): any {
		try {
			const parsed = JSON.parse(
				typeof raw === "string"
					? raw
					: Buffer.from(raw).toString("utf8"),
			);
			return parsed && typeof parsed === "object" ? parsed : {};
		} catch {
			return {};
		}
	}
	private integer(value: unknown, fallback: number) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
	}
	private optionalInteger(value: unknown) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
	}
	private failure(message: any) {
		return new Error(
			`Aliyun ASR failed: ${message.header?.error_code ?? "UNKNOWN"} ${message.header?.error_message ?? "Unknown error"}`,
		);
	}
}

export interface OpenAICompatibleConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
	timeoutMs: number;
}
export function cloudAsrConfig(env: Env = process.env): OpenAICompatibleConfig {
	return {
		apiKey: value(env, "CLOUD_ASR_API_KEY", "OPENAI_API_KEY"),
		baseUrl: (
			value(env, "CLOUD_ASR_BASE_URL", "OPENAI_BASE_URL") ||
			"https://api.openai.com/v1"
		).replace(/\/$/, ""),
		model: value(env, "CLOUD_ASR_MODEL") || "whisper-1",
		timeoutMs: numberValue(env, "ASR_TIMEOUT_SECONDS", 30) * 1000,
	};
}
export function translationConfig(
	env: Env = process.env,
): OpenAICompatibleConfig {
	return {
		apiKey: value(env, "TRANSLATION_API_KEY", "OPENAI_API_KEY"),
		baseUrl: (
			value(env, "TRANSLATION_BASE_URL", "OPENAI_BASE_URL") ||
			"https://api.openai.com/v1"
		).replace(/\/$/, ""),
		model: value(env, "TRANSLATION_MODEL") || "gpt-4.1-nano",
		timeoutMs: numberValue(env, "TRANSLATION_TIMEOUT_SECONDS", 20) * 1000,
	};
}
export function agentConfig(env: Env = process.env): OpenAICompatibleConfig {
	return {
		apiKey: value(env, "AGENT_API_KEY", "OPENAI_API_KEY"),
		baseUrl: (
			value(env, "AGENT_BASE_URL", "OPENAI_BASE_URL") ||
			"https://api.openai.com/v1"
		).replace(/\/$/, ""),
		model: value(env, "AGENT_MODEL") || "gpt-4.1-nano",
		timeoutMs: numberValue(env, "AGENT_TIMEOUT_SECONDS", 45) * 1000,
	};
}
async function request(
	url: string,
	options: RequestInit,
	timeoutMs: number,
	fetcher: typeof fetch,
) {
	const response = await fetcher(url, {
		...options,
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`Cloud provider failed: HTTP ${response.status}`);
	}
	return response;
}
export async function transcribePcm(
	pcm: Uint8Array,
	options: {
		config?: OpenAICompatibleConfig;
		language?: string;
		fetcher?: typeof fetch;
		baseStartMs?: number;
	} = {},
) {
	const config = options.config ?? cloudAsrConfig();
	if (!config.apiKey) {
		throw new Error("Cloud ASR is not configured");
	}
	const form = new FormData();
	form.set(
		"file",
		new Blob([pcm16ToWav(pcm)], { type: "audio/wav" }),
		"audio.wav",
	);
	form.set("model", config.model);
	if (options.language && options.language !== "auto") {
		form.set("language", options.language);
	}
	const response = await request(
		`${config.baseUrl}/audio/transcriptions`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${config.apiKey}` },
			body: form,
		},
		config.timeoutMs,
		options.fetcher ?? fetch,
	);
	const body = (await response.json()) as { text?: string };
	const text = body.text?.trim();
	if (!text) {
		return [];
	}
	const startMs = options.baseStartMs ?? 0;
	return [
		{
			segmentKey: `cloud-${startMs}-${startMs + pcm16DurationMs(pcm)}`,
			speaker: "S?",
			startMs,
			endMs: startMs + pcm16DurationMs(pcm),
			text,
			language: options.language ?? "auto",
		} satisfies TranscriptSegment,
	];
}
export async function translateText(
	text: string,
	options: {
		config?: OpenAICompatibleConfig;
		sourceLanguage?: string;
		targetLanguage: string;
		fetcher?: typeof fetch;
	},
) {
	const config = options.config ?? translationConfig();
	if (!config.apiKey) {
		throw new Error("Cloud translation is not configured");
	}
	const response = await request(
		`${config.baseUrl}/chat/completions`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: config.model,
				temperature: 0.2,
				messages: [
					{
						role: "system",
						content: `Translate into ${options.targetLanguage}. Return only the translation.`,
					},
					{ role: "user", content: text },
				],
			}),
		},
		config.timeoutMs,
		options.fetcher ?? fetch,
	);
	const body = (await response.json()) as any;
	const content = body.choices?.[0]?.message?.content?.trim();
	if (!content) {
		throw new Error("Cloud translation returned an empty response");
	}
	return content as string;
}
export async function chatWithAgent(
	messages: ChatMessage[],
	options: {
		config?: OpenAICompatibleConfig;
		systemPrompt?: string;
		fetcher?: typeof fetch;
	} = {},
) {
	const config = options.config ?? agentConfig();
	if (!config.apiKey) {
		throw new Error("Agent chat is not configured");
	}
	const response = await request(
		`${config.baseUrl}/chat/completions`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: config.model,
				temperature: 0.4,
				max_tokens: 1_000,
				messages: [
					{
						role: "system",
						content:
							options.systemPrompt ??
							"You are a concise, reliable interview assistant.",
					},
					...messages.slice(-20),
				],
			}),
		},
		config.timeoutMs,
		options.fetcher ?? fetch,
	);
	const body = (await response.json()) as any;
	const content = body.choices?.[0]?.message?.content?.trim();
	if (!content) {
		throw new Error("Agent chat returned an empty response");
	}
	return content as string;
}

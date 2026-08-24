import { z } from "zod";

export const interviewAgentSchema = z.object({
	id: z.string().min(1).max(120),
	name: z.string().trim().min(1).max(32),
	model: z.string().trim().min(1).max(120),
	prompt: z.string().trim().min(1).max(8_000),
	includeTranscript: z.boolean().default(false),
	includeHistory: z.boolean().default(false),
});

export type InterviewAgent = z.infer<typeof interviewAgentSchema>;

export const autoAgentSchema = z.object({
	enabled: z.boolean().default(false),
	model: z.string().trim().min(1).max(120).default("deepseek-v4-flash"),
	prompt: z
		.string()
		.trim()
		.min(1)
		.max(8_000)
		.default(
			"你是一个会议助手。请根据以下字幕内容，用中文生成：\n1. 关键摘要（3-5句）\n2. 行动项（如有）\n3. 需要跟进的问题（如有）\n格式简洁，分段清晰。",
		),
	debounceSeconds: z.coerce.number().min(2).max(30).default(4),
});

export type AutoAgentSettings = z.infer<typeof autoAgentSchema>;

export const defaultAutoAgentSettings: AutoAgentSettings = {
	enabled: false,
	model: "deepseek-v4-flash",
	prompt: "你是一个会议助手。请根据以下字幕内容，用中文生成：\n1. 关键摘要（3-5句）\n2. 行动项（如有）\n3. 需要跟进的问题（如有）\n格式简洁，分段清晰。",
	debounceSeconds: 4,
};

export const defaultInterviewAgents: InterviewAgent[] = [
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

export const defaultInterviewAgent =
	defaultInterviewAgents[0] as InterviewAgent;

export const interviewSettingsSchema = z.object({
	inputSource: z
		.enum(["mic", "system", "mixed", "file"])
		.catch("mic")
		.default("mic"),
	asrEngineSelect: z
		.enum(["auto", "cloud", "aliyun"])
		.catch("aliyun")
		.default("aliyun"),
	sourceLang: z.enum(["auto", "zh", "en"]).catch("en").default("en"),
	targetLang: z.enum(["auto", "zh", "en"]).catch("zh").default("zh"),
	translationEngine: z
		.enum(["auto", "cloud"])
		.catch("cloud")
		.default("cloud"),
	silence: z.coerce.number().min(0.2).max(10).default(1),
	lineWidth: z.coerce.number().int().min(6).max(1_000).default(100),
	translationInterval: z.coerce.number().min(1).max(30).default(3),
	autoAgent: autoAgentSchema
		.catch(defaultAutoAgentSettings)
		.default(defaultAutoAgentSettings),
	agents: z
		.array(interviewAgentSchema)
		.min(1)
		.max(12)
		.catch(defaultInterviewAgents),
	activeAgentId: z.string().min(1).max(120).catch(defaultInterviewAgent.id),
});

export type InterviewSettings = z.infer<typeof interviewSettingsSchema>;

export const defaultInterviewSettings: InterviewSettings = {
	inputSource: "mic",
	asrEngineSelect: "aliyun",
	sourceLang: "en",
	targetLang: "zh",
	translationEngine: "cloud",
	silence: 1,
	lineWidth: 100,
	translationInterval: 3,
	autoAgent: structuredClone(defaultAutoAgentSettings),
	agents: structuredClone(defaultInterviewAgents),
	activeAgentId: defaultInterviewAgent.id,
};

export function normalizeInterviewSettings(value: unknown): InterviewSettings {
	const input = value && typeof value === "object" ? value : {};
	const parsed = interviewSettingsSchema.safeParse({
		...defaultInterviewSettings,
		...input,
	});
	return parsed.success
		? parsed.data
		: structuredClone(defaultInterviewSettings);
}

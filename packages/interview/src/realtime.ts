import { z } from "zod";

export const realtimeClientEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("configure"),
		token: z.string().min(1),
		sourceLang: z.string().min(1),
		targetLang: z.string().min(1),
		asrEngine: z.enum(["aliyun", "cloud"]),
		silenceMs: z.number().int().min(200).max(10_000),
		lineWidth: z.number().int().min(6).max(1_000),
		translationIntervalMs: z
			.number()
			.int()
			.min(1_000)
			.max(30_000)
			.default(3_000),
	}),
	z.object({ type: z.literal("stop") }),
	z.object({
		type: z.literal("chat_message"),
		content: z.string().min(1).max(32_000),
	}),
	z.object({
		type: z.literal("notes_save"),
		content: z.string().max(100_000),
	}),
	z.object({ type: z.literal("ping") }),
]);
export type RealtimeClientEvent = z.infer<typeof realtimeClientEventSchema>;

const memberSchema = z.object({ userId: z.string(), displayName: z.string() });
export const realtimeServerEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("ready"),
		interviewId: z.string(),
		member: memberSchema,
	}),
	z.object({
		type: z.literal("configured"),
		sourceLang: z.string(),
		targetLang: z.string(),
		asrEngine: z.enum(["aliyun", "cloud"]),
		silenceMs: z.number().int().min(200).max(10_000),
		lineWidth: z.number().int().min(6).max(1_000),
		translationIntervalMs: z.number().int().min(1_000).max(30_000),
	}),
	z.object({
		type: z.literal("segment"),
		segment: z.object({
			segmentKey: z.string(),
			speaker: z.string().optional(),
			text: z.string(),
			translation: z.string().optional(),
			sourceLang: z.string(),
			targetLang: z.string(),
			translationEngine: z.string().optional(),
			translationIsPartial: z.boolean().optional(),
			translationSourceText: z.string().optional(),
			startMs: z.number(),
			endMs: z.number(),
			isFinal: z.boolean(),
		}),
	}),
	z.object({
		type: z.literal("chat_message"),
		message: z.object({
			id: z.string(),
			role: z.string(),
			content: z.string(),
			createdAt: z.string(),
			sender: z.string().optional(),
			authorId: z.string().optional(),
			agentId: z.string().optional(),
		}),
	}),
	z.object({
		type: z.literal("notes_update"),
		content: z.string(),
		updatedAt: z.string(),
	}),
	z.object({
		type: z.literal("members_update"),
		members: z.array(memberSchema),
	}),
	z.object({
		type: z.literal("level"),
		rms: z.number().min(0),
		durationMs: z.number().int().min(0),
	}),
	z.object({ type: z.literal("stopped") }),
	z.object({
		type: z.literal("error"),
		code: z.string(),
		message: z.string(),
	}),
	z.object({ type: z.literal("pong") }),
]);
export type RealtimeServerEvent = z.infer<typeof realtimeServerEventSchema>;

import { z } from "zod";

export const interviewStatusSchema = z.enum([
	"draft",
	"active",
	"completed",
	"archived",
]);
export type InterviewStatus = z.infer<typeof interviewStatusSchema>;

export const transcriptSegmentSchema = z.object({
	segmentKey: z.string().min(1).max(200),
	speaker: z.string().min(1).max(100).optional(),
	startMs: z.number().int().min(0),
	endMs: z.number().int().min(0),
	text: z.string().min(1),
	translation: z.string().optional(),
	language: z.string().min(1).max(32).optional(),
	sourceLang: z.string().min(1).max(32).optional(),
	targetLang: z.string().min(1).max(32).optional(),
	translationEngine: z.string().min(1).max(100).optional(),
	metadata: z.record(z.unknown()).optional(),
});
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const chatMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant"]),
	content: z.string().min(1).max(32_000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

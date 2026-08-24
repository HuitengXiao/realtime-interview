import assert from "node:assert/strict";
import test from "node:test";
import { mergeSharedChatMessages } from "../src/chat-sync";

test("shared chat merges persisted messages without dropping realtime messages", () => {
	const realtime = {
		id: "realtime",
		content: "already visible",
		role: "user",
		createdAt: "2026-08-24T08:00:01.000Z",
	};
	const incoming = {
		id: "agent-answer",
		content: "answer",
		role: "assistant",
		createdAt: "2026-08-24T08:00:00.000Z",
	};
	assert.deepEqual(mergeSharedChatMessages([realtime], [incoming]), [
		incoming,
		realtime,
	]);
});

test("shared chat replaces optimistic agent prompts and deduplicates responses", () => {
	const optimistic = {
		id: "temporary",
		content: "question",
		role: "user",
		authorId: "member",
		agentId: "agent",
	};
	const persisted = {
		...optimistic,
		id: "persisted",
		createdAt: "2026-08-24T08:00:00.000Z",
	};
	const response = {
		id: "response",
		content: "answer",
		role: "assistant",
		agentId: "agent",
		createdAt: "2026-08-24T08:00:01.000Z",
	};
	assert.deepEqual(
		mergeSharedChatMessages([optimistic, response], [persisted, response]),
		[persisted, response],
	);
});

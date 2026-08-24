import assert from "node:assert/strict";
import test from "node:test";
import {
	autoAgentTranscriptFingerprint,
	buildAutoAgentTranscript,
	recentAutoAgentSegments,
} from "../src/auto-agent";

test("builds autonomous Agent context with speaker, time, and translation", () => {
	assert.equal(
		buildAutoAgentTranscript([
			{
				id: "one",
				text: "Hello",
				translation: "你好",
				speaker: "S1",
				startMs: 65_000,
				endMs: 67_000,
				isFinal: true,
			},
		]),
		"[1:05–1:07] S1: Hello\n  译：你好",
	);
});

test("uses the latest 60 final segments", () => {
	const segments = Array.from({ length: 65 }, (_, index) => ({
		id: String(index),
		text: `line ${index}`,
		isFinal: true,
	}));
	assert.equal(recentAutoAgentSegments(segments).length, 60);
	assert.equal(recentAutoAgentSegments(segments)[0]?.id, "5");
});

test("fingerprint changes with transcript content and ignores empty segments", () => {
	const base = [{ id: "one", text: "hello", isFinal: true }];
	assert.equal(
		autoAgentTranscriptFingerprint([...base, { id: "empty", text: "" }]),
		autoAgentTranscriptFingerprint(base),
	);
	assert.notEqual(
		autoAgentTranscriptFingerprint(base),
		autoAgentTranscriptFingerprint([
			{ id: "one", text: "hello again", isFinal: true },
		]),
	);
});

test("translation backfill does not trigger the same transcript twice", () => {
	const original = [{ id: "one", text: "hello", isFinal: true }];
	const translated = [
		{
			id: "one",
			text: "hello",
			translation: "你好",
			isFinal: true,
		},
	];
	assert.equal(
		autoAgentTranscriptFingerprint(original),
		autoAgentTranscriptFingerprint(translated),
	);
});

test("partial speech is not marked as analyzed before it becomes final", () => {
	const partial = [{ id: "one", text: "still speaking", isFinal: false }];
	const final = [{ id: "one", text: "still speaking", isFinal: true }];
	assert.equal(autoAgentTranscriptFingerprint(partial), "");
	assert.notEqual(
		autoAgentTranscriptFingerprint(partial),
		autoAgentTranscriptFingerprint(final),
	);
});

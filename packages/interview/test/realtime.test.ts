import assert from "node:assert/strict";
import test from "node:test";
import { realtimeClientEventSchema } from "../src/realtime";

const configure = {
	type: "configure",
	token: "signed-token",
	sourceLang: "en",
	targetLang: "zh",
	asrEngine: "aliyun",
	lineWidth: 100,
	translationIntervalMs: 3_000,
};

test("realtime configuration requires a usable sentence silence value", () => {
	assert.equal(
		realtimeClientEventSchema.safeParse({ ...configure, silenceMs: 1_000 })
			.success,
		true,
	);
	assert.equal(
		realtimeClientEventSchema.safeParse({ ...configure, silenceMs: 100 })
			.success,
		false,
	);
	assert.equal(realtimeClientEventSchema.safeParse(configure).success, false);
});

test("realtime configuration validates the subtitle card size", () => {
	assert.equal(
		realtimeClientEventSchema.safeParse({
			...configure,
			silenceMs: 1_000,
			lineWidth: 5,
		}).success,
		false,
	);
});

test("realtime configuration validates the partial translation interval", () => {
	const { translationIntervalMs: _, ...legacyConfigure } = configure;
	assert.equal(
		realtimeClientEventSchema.safeParse({
			...legacyConfigure,
			silenceMs: 1_000,
		}).success,
		true,
	);
	assert.equal(
		realtimeClientEventSchema.safeParse({
			...configure,
			silenceMs: 1_000,
			translationIntervalMs: 999,
		}).success,
		false,
	);
	assert.equal(
		realtimeClientEventSchema.safeParse({
			...configure,
			silenceMs: 1_000,
			translationIntervalMs: 30_001,
		}).success,
		false,
	);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
	displayUnitCount,
	groupTranscriptSegmentsForDisplay,
	mergeRealtimeDisplaySegment,
} from "../src/display-segmentation";
import {
	type PcmUtterance,
	PcmUtteranceSegmenter,
	splitTranscriptSegment,
} from "../src/segmentation";

function frame(amplitude: number, durationMs = 100) {
	const samples = Math.round((16_000 * durationMs) / 1_000);
	const buffer = new ArrayBuffer(samples * 2);
	const view = new DataView(buffer);
	for (let index = 0; index < samples; index += 1) {
		view.setInt16(index * 2, amplitude, true);
	}
	return new Uint8Array(buffer);
}

test("cloud segmentation ignores leading silence and cuts after configured silence", () => {
	const segmenter = new PcmUtteranceSegmenter(300);
	segmenter.push(frame(0));
	segmenter.push(frame(0));
	segmenter.push(frame(2_000));
	segmenter.push(frame(0));
	segmenter.push(frame(0));
	const result = segmenter.push(frame(0));

	assert.equal(result.utterance?.startMs, 200);
	assert.equal(result.utterance?.endMs, 600);
	assert.equal(result.utterance?.pcm.byteLength, 16_000 * 2 * 0.4);
});

test("cloud segmentation enforces a maximum utterance duration", () => {
	const segmenter = new PcmUtteranceSegmenter(1_000, 0.012, 500);
	let utterance: PcmUtterance | undefined;
	for (let index = 0; index < 5; index += 1) {
		utterance = segmenter.push(frame(2_000)).utterance ?? utterance;
	}
	assert.equal(utterance?.startMs, 0);
	assert.equal(utterance?.endMs, 500);
});

test("segmentation validates sentence silence bounds", () => {
	assert.throws(
		() => new PcmUtteranceSegmenter(199),
		/between 200 and 10000/,
	);
	assert.throws(
		() => new PcmUtteranceSegmenter(10_001),
		/between 200 and 10000/,
	);
});

test("subtitle cards split on Chinese and English sentence punctuation", () => {
	const segments = splitTranscriptSegment(
		{
			segmentKey: "aliyun-1",
			startMs: 0,
			endMs: 3_000,
			text: "Can you hear me? 可以听见。Next question!",
		},
		100,
	);
	assert.deepEqual(
		segments.map((segment) => segment.text),
		["Can you hear me?", "可以听见。", "Next question!"],
	);
	assert.deepEqual(
		segments.map((segment) => segment.segmentKey),
		["aliyun-1-0", "aliyun-1-1", "aliyun-1-2"],
	);
	assert.equal(segments[0]?.startMs, 0);
	assert.equal(segments.at(-1)?.endMs, 3_000);
});

test("subtitle cards split an overlong unpunctuated sentence", () => {
	const segments = splitTranscriptSegment(
		{
			segmentKey: "long",
			startMs: 100,
			endMs: 1_100,
			text: "one two three four five six seven eight nine ten eleven twelve",
		},
		6,
	);
	assert.equal(segments.length, 2);
	assert.equal(segments[0]?.text, "one two three four five six");
	assert.equal(segments[1]?.text, "seven eight nine ten eleven twelve");
});

test("a growing realtime sentence keeps the same first card key", () => {
	const partial = splitTranscriptSegment(
		{ segmentKey: "stream", startMs: 0, endMs: 500, text: "Hello" },
		100,
	);
	const final = splitTranscriptSegment(
		{
			segmentKey: "stream",
			startMs: 0,
			endMs: 1_000,
			text: "Hello. Next.",
		},
		100,
	);
	assert.equal(partial[0]?.segmentKey, "stream-0");
	assert.equal(final[0]?.segmentKey, "stream-0");
});

test("display cards combine consecutive same-speaker segments up to the line width", () => {
	const cards = groupTranscriptSegmentsForDisplay(
		[
			{ id: "one", speaker: "S1", text: "one two", translation: "一 二" },
			{
				id: "two",
				speaker: "S1",
				text: "three four",
				translation: "三 四",
			},
			{
				id: "three",
				speaker: "S1",
				text: "five six seven",
				isFinal: false,
			},
			{ id: "four", speaker: "S2", text: "six" },
		],
		6,
	);

	assert.equal(cards.length, 3);
	assert.deepEqual(cards[0], {
		id: "display-card-one",
		speaker: "S1",
		text: "one two three four",
		translation: "一 二 三 四",
		isFinal: true,
	});
	assert.equal(cards[1]?.id, "display-card-three");
	assert.equal(cards[1]?.isFinal, false);
	assert.equal(cards[2]?.id, "display-card-four");
});

test("display unit count follows the legacy Chinese and English rules", () => {
	assert.equal(displayUnitCount("one two three"), 3);
	assert.equal(displayUnitCount("你好世界"), 4);
	assert.equal(displayUnitCount("hello 你好"), 3);
});

test("display cards keep a stable id while growing and split oversized history", () => {
	const first = groupTranscriptSegmentsForDisplay(
		[{ id: "one", text: "one two" }],
		6,
	);
	const grown = groupTranscriptSegmentsForDisplay(
		[
			{ id: "one", text: "one two" },
			{ id: "two", text: "three four" },
		],
		6,
	);
	const historical = groupTranscriptSegmentsForDisplay(
		[{ id: "history", text: "one two three four five six seven" }],
		6,
	);

	assert.equal(first[0]?.id, "display-card-one");
	assert.equal(grown[0]?.id, "display-card-one");
	assert.deepEqual(
		historical.map((card) => card.text),
		["one two three four five six", "seven"],
	);
});

test("display cards split mixed Chinese and English by display units", () => {
	const text = `${"你".repeat(7)} ${Array.from({ length: 7 }, (_, index) => `word${index}`).join(" ")}`;
	const cards = groupTranscriptSegmentsForDisplay([{ id: "mixed", text }], 6);

	assert.equal(cards.length, 3);
	assert.equal(
		cards.every((card) => displayUnitCount(card.text) <= 6),
		true,
	);
	assert.equal(
		cards
			.map((card) => card.text)
			.join(" ")
			.includes("word0"),
		true,
	);
});

test("realtime partial translations keep their source version and clear on final", () => {
	const translated = {
		id: "live",
		text: "hello",
		translation: "你好",
		translationIsPartial: true,
		translationSourceText: "hello",
		isFinal: false,
	};
	const grown = mergeRealtimeDisplaySegment(translated, {
		id: "live",
		text: "hello world",
		isFinal: false,
	});
	const final = mergeRealtimeDisplaySegment(grown, {
		id: "live",
		text: "hello world.",
		isFinal: true,
	});

	assert.equal(grown.translation, "你好");
	assert.equal(grown.translationSourceText, "hello");
	assert.equal(final.translation, undefined);
	assert.equal(final.translationIsPartial, undefined);
});

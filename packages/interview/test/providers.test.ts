import assert from "node:assert/strict";
import test from "node:test";
import {
	AliyunParaformerStream,
	type StreamingSocket,
	aliyunSettings,
	translationConfig,
} from "../src/providers";

test("Aliyun settings use workspace endpoint and service key", () => {
	const settings = aliyunSettings({
		DASHSCOPE_API_KEY: "service-key",
		OPENAI_API_KEY: "fallback",
		ALIYUN_ASR_WORKSPACE_ID: "workspace",
		ALIYUN_ASR_REGION: "cn-hangzhou",
	});
	assert.equal(settings.apiKey, "service-key");
	assert.equal(
		settings.endpoint,
		"wss://workspace.cn-hangzhou.maas.aliyuncs.com/api-ws/v1/inference",
	);
});
test("translation configuration prefers its dedicated credentials", () => {
	const config = translationConfig({
		TRANSLATION_API_KEY: "translation-key",
		TRANSLATION_BASE_URL: "https://translate.example/v1/",
		TRANSLATION_MODEL: "translator",
		OPENAI_API_KEY: "fallback",
	});
	assert.deepEqual(config, {
		apiKey: "translation-key",
		baseUrl: "https://translate.example/v1",
		model: "translator",
		timeoutMs: 20_000,
	});
});
test("Aliyun stream sends run/finish commands and maps final events", async () => {
	const sent: Array<string | Uint8Array> = [];
	const messages = [
		JSON.stringify({ header: { event: "task-started" } }),
		JSON.stringify({
			header: { event: "result-generated" },
			payload: {
				output: {
					sentence: {
						begin_time: 10,
						end_time: 20,
						text: "hello",
						sentence_end: true,
					},
				},
				usage: { duration: 2 },
			},
		}),
	];
	const socket: StreamingSocket = {
		send(value) {
			sent.push(value);
		},
		async receive() {
			const message = messages.shift();
			if (!message) {
				throw new Error("unexpected receive");
			}
			return message;
		},
		close() {},
	};
	const settings = aliyunSettings({ DASHSCOPE_API_KEY: "key" });
	const stream = new AliyunParaformerStream(
		{ ...settings, maxSentenceSilence: 1_250 },
		"en",
		async () => socket,
	);
	await stream.start();
	await stream.sendAudio(new Uint8Array([0, 1]));
	const event = await stream.receiveEvent();
	await stream.finish();
	const runTask = JSON.parse(String(sent[0]));
	assert.equal(event?.segment.text, "hello");
	assert.equal(event?.segment.endMs, 20);
	assert.equal(event?.isFinal, true);
	assert.match(String(sent[0]), /run-task/);
	assert.equal(runTask.payload.parameters.max_sentence_silence, 1_250);
	assert.ok(sent[1] instanceof Uint8Array);
	assert.match(String(sent[2]), /finish-task/);
});

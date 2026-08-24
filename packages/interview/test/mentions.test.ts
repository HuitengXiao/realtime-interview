import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentMention } from "../src/mentions";

const agents = [
	{ id: "translate", name: "翻译" },
	{ id: "culture", name: "文化" },
];

test("routes an Agent mention at the beginning or end of a message", () => {
	assert.deepEqual(resolveAgentMention("@翻译 hello", agents), {
		agent: agents[0],
		content: "hello",
	});
	assert.deepEqual(resolveAgentMention("解释这个背景 @文化", agents), {
		agent: agents[1],
		content: "解释这个背景",
	});
});

test("keeps an ordinary room message and rejects an unknown mention", () => {
	assert.deepEqual(resolveAgentMention("大家好", agents), {
		content: "大家好",
	});
	assert.throws(
		() => resolveAgentMention("@不存在 hello", agents),
		/没有找到/,
	);
});

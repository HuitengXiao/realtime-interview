import assert from "node:assert/strict";
import test from "node:test";
import {
	defaultInterviewSettings,
	normalizeInterviewSettings,
} from "../src/settings";

test("normalizes migrated FunASR settings and keeps Agent configuration", () => {
	const settings = normalizeInterviewSettings({
		asrEngineSelect: "funasr-realtime",
		sourceLang: "en",
		targetLang: "zh",
		agents: [
			{
				id: "researcher",
				name: "研究助手",
				model: "deepseek-v4-flash",
				prompt: "提炼用户洞察",
				includeTranscript: true,
				includeHistory: false,
			},
		],
		activeAgentId: "researcher",
	});

	assert.equal(settings.asrEngineSelect, "aliyun");
	assert.equal(settings.sourceLang, "en");
	assert.equal(settings.targetLang, "zh");
	assert.equal(settings.agents[0]?.name, "研究助手");
	assert.equal(settings.agents[0]?.includeTranscript, true);
	assert.equal(settings.activeAgentId, "researcher");
});

test("provides cloud-only defaults for new interview rooms", () => {
	assert.equal(defaultInterviewSettings.inputSource, "mic");
	assert.equal(defaultInterviewSettings.asrEngineSelect, "aliyun");
	assert.equal(defaultInterviewSettings.sourceLang, "en");
	assert.equal(defaultInterviewSettings.targetLang, "zh");
	assert.equal(defaultInterviewSettings.translationEngine, "cloud");
	assert.equal(defaultInterviewSettings.lineWidth, 100);
	assert.equal(defaultInterviewSettings.translationInterval, 3);
	assert.deepEqual(defaultInterviewSettings.autoAgent, {
		enabled: false,
		model: "deepseek-v4-flash",
		prompt: "你是一个会议助手。请根据以下字幕内容，用中文生成：\n1. 关键摘要（3-5句）\n2. 行动项（如有）\n3. 需要跟进的问题（如有）\n格式简洁，分段清晰。",
		debounceSeconds: 4,
	});
	assert.deepEqual(
		defaultInterviewSettings.agents.map((agent) => agent.name),
		["翻译", "音标", "通用", "文化"],
	);
});

test("normalizes autonomous Agent settings within their safe bounds", () => {
	const settings = normalizeInterviewSettings({
		autoAgent: {
			enabled: true,
			model: "  custom-agent  ",
			prompt: "  生成会议观察  ",
			debounceSeconds: "8",
		},
	});

	assert.deepEqual(settings.autoAgent, {
		enabled: true,
		model: "custom-agent",
		prompt: "生成会议观察",
		debounceSeconds: 8,
	});
	assert.deepEqual(
		normalizeInterviewSettings({
			autoAgent: { enabled: true, debounceSeconds: 31 },
		}).autoAgent,
		defaultInterviewSettings.autoAgent,
	);
});

test("drops legacy local-model controls that cannot affect cloud realtime ASR", () => {
	const settings = normalizeInterviewSettings({
		scope: "session",
		threshold: 0.05,
		lineWidth: 12,
		translationWords: 8,
		translationContext: 42,
	});
	assert.equal("scope" in settings, false);
	assert.equal("threshold" in settings, false);
	assert.equal(settings.lineWidth, 12);
	assert.equal("translationWords" in settings, false);
	assert.equal("translationContext" in settings, false);
});

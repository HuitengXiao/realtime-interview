export type MentionableAgent = { id: string; name: string };

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveAgentMention<T extends MentionableAgent>(
	text: string,
	agents: T[],
): { content: string; agent?: T } {
	const trimmed = text.trim();
	const sorted = [...agents].sort(
		(left, right) => right.name.length - left.name.length,
	);
	let match: { agent: T; index: number; length: number } | undefined;
	for (const agent of sorted) {
		const pattern = new RegExp(`@${escapeRegExp(agent.name)}`, "gi");
		for (
			let result = pattern.exec(trimmed);
			result;
			result = pattern.exec(trimmed)
		) {
			if (!match || result.index >= match.index) {
				match = {
					agent,
					index: result.index,
					length: result[0].length,
				};
			}
		}
	}
	if (!match) {
		const unknown = trimmed.match(/(?:^|\s)@(\S+)/);
		if (unknown) {
			throw new Error(`没有找到 @${unknown[1]}，请从候选列表选择 Agent`);
		}
		return { content: trimmed };
	}
	return {
		agent: match.agent,
		content:
			`${trimmed.slice(0, match.index)} ${trimmed.slice(match.index + match.length)}`.trim(),
	};
}

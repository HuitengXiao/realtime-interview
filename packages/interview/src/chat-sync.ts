export type SharedChatMessage = {
	id: string;
	content: string;
	role?: string;
	authorId?: string;
	agentId?: string;
	createdAt?: string;
};

function isPersistedMatch(
	optimistic: SharedChatMessage,
	persisted: SharedChatMessage,
) {
	return (
		!optimistic.createdAt &&
		optimistic.role === persisted.role &&
		optimistic.content === persisted.content &&
		optimistic.authorId === persisted.authorId &&
		optimistic.agentId === persisted.agentId
	);
}

export function mergeSharedChatMessages<T extends SharedChatMessage>(
	current: T[],
	incoming: T[],
) {
	const incomingById = new Map(
		incoming.map((message) => [message.id, message]),
	);
	const next = current
		.map((message) => incomingById.get(message.id) ?? message)
		.filter(
			(message) =>
				!incoming.some((candidate) =>
					isPersistedMatch(message, candidate),
				),
		);
	const seen = new Set(next.map((message) => message.id));
	for (const message of incoming) {
		if (!seen.has(message.id)) {
			next.push(message);
			seen.add(message.id);
		}
	}
	next.sort((left, right) => {
		if (!left.createdAt) {
			return right.createdAt ? 1 : 0;
		}
		if (!right.createdAt) {
			return -1;
		}
		return (
			left.createdAt.localeCompare(right.createdAt) ||
			left.id.localeCompare(right.id)
		);
	});
	return next;
}

/** The transcript shape needed to compose cards in the client. */
export type DisplayTranscriptSegment = {
	id: string;
	text: string;
	translation?: string;
	isFinal?: boolean;
	speaker?: string;
	timestamp?: string;
	startMs?: number;
	endMs?: number;
	translationIsPartial?: boolean;
	translationSourceText?: string;
};

export function mergeRealtimeDisplaySegment(
	current: DisplayTranscriptSegment,
	incoming: DisplayTranscriptSegment,
): DisplayTranscriptSegment {
	const hasTranslation = typeof incoming.translation === "string";
	const merged = { ...current, ...incoming };
	if (hasTranslation) {
		return merged;
	}
	if (incoming.isFinal === true) {
		return {
			...merged,
			translation: undefined,
			translationIsPartial: undefined,
			translationSourceText: undefined,
		};
	}
	return {
		...merged,
		translation: current.translation,
		translationIsPartial: current.translationIsPartial,
		translationSourceText: current.translationSourceText,
	};
}

/** Counts display units the same way as the legacy client. */
export function displayUnitCount(value: string) {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (!normalized) {
		return 0;
	}
	return (
		normalized.match(/[\u3400-\u9fff]|[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g)
			?.length ?? 0
	);
}

function splitTextIntoCount(value: string | undefined, count: number) {
	const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
	if (!normalized) {
		return Array<string>(count).fill("");
	}
	if (/[\u3400-\u9fff]/.test(normalized) || !normalized.includes(" ")) {
		const characters = Array.from(normalized);
		return Array.from({ length: count }, (_, index) => {
			const start = Math.round((characters.length * index) / count);
			const end = Math.round((characters.length * (index + 1)) / count);
			return characters.slice(start, end).join("").trim();
		});
	}
	const words = normalized.split(/\s+/).filter(Boolean);
	return Array.from({ length: count }, (_, index) => {
		const start = Math.round((words.length * index) / count);
		const end = Math.round((words.length * (index + 1)) / count);
		return words.slice(start, end).join(" ");
	});
}

function splitTextByUnits(value: string, limit: number) {
	const pieces =
		value.match(
			/\s+|[\u3400-\u9fff]|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^\s]/g,
		) ?? [];
	const chunks: string[] = [];
	let current = "";
	let units = 0;
	for (const piece of pieces) {
		const pieceUnits = displayUnitCount(piece);
		if (current.trim() && pieceUnits > 0 && units + pieceUnits > limit) {
			chunks.push(current.trim());
			current = "";
			units = 0;
		}
		current += piece;
		units += pieceUnits;
	}
	if (current.trim()) {
		chunks.push(current.trim());
	}
	return chunks;
}

function splitOversizedSegment(
	segment: DisplayTranscriptSegment,
	limit: number,
) {
	const texts = splitTextByUnits(segment.text, limit);
	if (texts.length <= 1) {
		return [{ ...segment, id: `display-card-${segment.id}` }];
	}
	const count = texts.length;
	const translations = splitTextIntoCount(segment.translation, count);
	const duration =
		segment.startMs === undefined || segment.endMs === undefined
			? undefined
			: Math.max(0, segment.endMs - segment.startMs);
	return texts.map((text, index) => ({
		...segment,
		id: `display-card-${segment.id}-${index}`,
		text,
		translation: translations[index] || undefined,
		...(duration === undefined
			? {}
			: {
					startMs:
						(segment.startMs as number) +
						Math.round((duration * index) / count),
					endMs:
						(segment.startMs as number) +
						Math.round((duration * (index + 1)) / count),
				}),
	}));
}

/**
 * Combines consecutive segments into subtitle cards without changing the
 * persisted source segments, so the current line-width also affects history.
 */
export function groupTranscriptSegmentsForDisplay(
	segments: DisplayTranscriptSegment[],
	maximumUnits: number,
): DisplayTranscriptSegment[] {
	const limit = Math.max(6, Math.min(1_000, Math.trunc(maximumUnits)));
	const result: DisplayTranscriptSegment[] = [];
	let group: DisplayTranscriptSegment[] = [];
	let groupUnits = 0;

	const flushGroup = () => {
		if (group.length === 1) {
			result.push(
				...splitOversizedSegment(
					group[0] as DisplayTranscriptSegment,
					limit,
				),
			);
		} else if (group.length > 1) {
			const first = group[0] as DisplayTranscriptSegment;
			const last = group[group.length - 1] as DisplayTranscriptSegment;
			const hasPartialTranslation = group.some(
				(segment) => segment.translationIsPartial === true,
			);
			result.push({
				...last,
				id: `display-card-${first.id}`,
				speaker: first.speaker,
				...(first.startMs === undefined
					? {}
					: { startMs: first.startMs }),
				...(last.endMs === undefined ? {} : { endMs: last.endMs }),
				text: group
					.map((segment) => segment.text.trim())
					.filter(Boolean)
					.join(" "),
				translation:
					group
						.map((segment) => segment.translation?.trim())
						.filter((translation): translation is string =>
							Boolean(translation),
						)
						.join(" ") || undefined,
				isFinal: group.every((segment) => segment.isFinal !== false),
				...(hasPartialTranslation
					? {
							translationIsPartial: true,
							translationSourceText: group
								.filter((segment) => segment.translation)
								.map(
									(segment) =>
										segment.translationSourceText ??
										segment.text,
								)
								.join(" "),
						}
					: {}),
			});
		}
		group = [];
		groupUnits = 0;
	};

	for (const segment of segments) {
		const units = Math.max(1, displayUnitCount(segment.text));
		if (units > limit) {
			flushGroup();
			result.push(...splitOversizedSegment(segment, limit));
			continue;
		}
		const sameSpeaker =
			!group.length ||
			(group[0] as DisplayTranscriptSegment).speaker === segment.speaker;
		if (group.length && (!sameSpeaker || groupUnits + units > limit)) {
			flushGroup();
		}
		group.push(segment);
		groupUnits += units;
	}
	flushGroup();
	return result;
}

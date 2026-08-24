export type AutoAgentTranscriptSegment = {
	id?: string;
	text?: string;
	translation?: string;
	speaker?: string;
	timestamp?: string;
	startMs?: number;
	endMs?: number;
	isFinal?: boolean;
};

function formatTime(milliseconds?: number) {
	if (!Number.isFinite(milliseconds)) {
		return "";
	}
	const totalSeconds = Math.max(0, Math.floor((milliseconds ?? 0) / 1_000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function recentAutoAgentSegments(
	segments: AutoAgentTranscriptSegment[],
	limit = 60,
) {
	const usable = segments.filter((segment) => segment.text?.trim());
	const finalSegments = usable.filter((segment) => segment.isFinal !== false);
	return (finalSegments.length ? finalSegments : usable).slice(-limit);
}

export function buildAutoAgentTranscript(
	segments: AutoAgentTranscriptSegment[],
	limit = 60,
) {
	return recentAutoAgentSegments(segments, limit)
		.map((segment) => {
			const start = segment.timestamp || formatTime(segment.startMs);
			const end = formatTime(segment.endMs);
			const time = start ? `[${start}${end ? `–${end}` : ""}] ` : "";
			const speaker = segment.speaker?.trim() || "S?";
			const translation = segment.translation?.trim()
				? `\n  译：${segment.translation.trim()}`
				: "";
			return `${time}${speaker}: ${segment.text?.trim()}${translation}`;
		})
		.join("\n");
}

export function autoAgentTranscriptFingerprint(
	segments: AutoAgentTranscriptSegment[],
	limit = 60,
) {
	return segments
		.filter((segment) => segment.text?.trim() && segment.isFinal !== false)
		.slice(-limit)
		.map((segment) =>
			[segment.id ?? "", segment.text?.trim() ?? ""].join(""),
		)
		.join("");
}

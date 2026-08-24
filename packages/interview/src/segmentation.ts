import { pcm16DurationMs, pcm16Rms } from "./audio";
import type { TranscriptSegment } from "./types";

export type PcmUtterance = {
	pcm: Uint8Array;
	startMs: number;
	endMs: number;
};

export type SegmentationResult = {
	rms: number;
	durationMs: number;
	utterance?: PcmUtterance;
};

function concat(chunks: Uint8Array[]) {
	const result = new Uint8Array(
		chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

/**
 * Buffers the non-streaming cloud fallback into utterances. Aliyun realtime
 * performs sentence detection upstream using max_sentence_silence instead.
 */
export class PcmUtteranceSegmenter {
	private clockMs = 0;
	private startMs = 0;
	private activeDurationMs = 0;
	private silenceDurationMs = 0;
	private chunks: Uint8Array[] = [];

	constructor(
		private readonly silenceMs: number,
		private readonly threshold = 0.012,
		private readonly maximumUtteranceMs = 8_000,
	) {
		if (
			!Number.isFinite(silenceMs) ||
			silenceMs < 200 ||
			silenceMs > 10_000
		) {
			throw new Error("silenceMs must be between 200 and 10000");
		}
	}

	push(pcm: Uint8Array): SegmentationResult {
		const durationMs = pcm16DurationMs(pcm);
		const rms = pcm16Rms(pcm);
		const frameStartMs = this.clockMs;
		this.clockMs += durationMs;
		const voiced = rms >= this.threshold;

		if (!this.chunks.length) {
			if (!voiced) {
				return { rms, durationMs };
			}
			this.startMs = frameStartMs;
		}

		this.chunks.push(pcm);
		this.activeDurationMs += durationMs;
		this.silenceDurationMs = voiced
			? 0
			: this.silenceDurationMs + durationMs;

		const shouldFlush =
			this.silenceDurationMs >= this.silenceMs ||
			(this.maximumUtteranceMs > 0 &&
				this.activeDurationMs >= this.maximumUtteranceMs);
		return {
			rms,
			durationMs,
			...(shouldFlush ? { utterance: this.flush() } : {}),
		};
	}

	flush(): PcmUtterance | undefined {
		if (!this.chunks.length) {
			return undefined;
		}
		const utterance = {
			pcm: concat(this.chunks),
			startMs: this.startMs,
			endMs: this.startMs + this.activeDurationMs,
		};
		this.chunks = [];
		this.activeDurationMs = 0;
		this.silenceDurationMs = 0;
		return utterance;
	}
}

// biome-ignore lint/complexity/useRegexLiterals: constructors avoid cross-workspace TypeScript target parsing errors.
const wordUnitPattern = new RegExp("[\\p{L}\\p{N}]", "u");
// biome-ignore lint/complexity/useRegexLiterals: constructors avoid cross-workspace TypeScript target parsing errors.
const sentencePiecePattern = new RegExp(
	"\\s+|[\\u3400-\\u9fff]|[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*|[^\\s]",
	"gu",
);
// biome-ignore lint/complexity/useRegexLiterals: constructors avoid cross-workspace TypeScript target parsing errors.
const sentencePattern = new RegExp("[^.!?。！？；;\\n]+[.!?。！？；;]?", "gu");

function textUnits(value: string) {
	const han = value.match(/[\u3400-\u9fff]/g)?.length ?? 0;
	if (han) {
		return han;
	}
	return wordUnitPattern.test(value) ? 1 : 0;
}

function splitLongSentence(sentence: string, maximumUnits: number) {
	const pieces = sentence.match(sentencePiecePattern) ?? [];
	const chunks: string[] = [];
	let current = "";
	let units = 0;
	for (const piece of pieces) {
		const pieceUnits = textUnits(piece);
		if (
			current.trim() &&
			pieceUnits > 0 &&
			units + pieceUnits > maximumUnits
		) {
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

export function splitTranscriptSegment(
	segment: TranscriptSegment,
	maximumUnits: number,
) {
	const safeMaximum = Math.max(6, Math.min(1_000, Math.trunc(maximumUnits)));
	const sentences =
		segment.text
			.match(sentencePattern)
			?.map((value) => value.trim())
			.filter(Boolean) ?? [];
	const texts = sentences.flatMap((sentence) =>
		splitLongSentence(sentence, safeMaximum),
	);
	if (texts.length <= 1) {
		return [
			{
				...segment,
				segmentKey: `${segment.segmentKey}-0`,
				text: texts[0] ?? segment.text.trim(),
			},
		];
	}

	const totalWeight = texts.reduce((total, text) => total + text.length, 0);
	const duration = Math.max(1, segment.endMs - segment.startMs);
	let consumedWeight = 0;
	return texts.map((text, index) => {
		const startMs =
			segment.startMs +
			Math.floor((duration * consumedWeight) / totalWeight);
		consumedWeight += text.length;
		const endMs =
			index === texts.length - 1
				? segment.endMs
				: segment.startMs +
					Math.floor((duration * consumedWeight) / totalWeight);
		return {
			...segment,
			segmentKey: `${segment.segmentKey}-${index}`,
			text,
			startMs,
			endMs: Math.max(startMs + 1, endMs),
		};
	});
}

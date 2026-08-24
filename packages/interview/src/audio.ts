export const PCM16_SAMPLE_RATE = 16_000;
export const PCM16_CHANNELS = 1;

export function pcm16DurationMs(
	pcm: Uint8Array,
	sampleRate = PCM16_SAMPLE_RATE,
	channels = PCM16_CHANNELS,
) {
	if (sampleRate <= 0 || channels <= 0) {
		throw new Error("Invalid PCM audio format");
	}
	return Math.floor((pcm.byteLength / 2 / channels / sampleRate) * 1000);
}

export function pcm16Rms(pcm: Uint8Array) {
	if (pcm.byteLength < 2) {
		return 0;
	}
	const samples = Math.floor(pcm.byteLength / 2);
	let sum = 0;
	const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	for (let index = 0; index < samples; index += 1) {
		const value = view.getInt16(index * 2, true) / 32_768;
		sum += value * value;
	}
	return Math.sqrt(sum / samples);
}

export function pcm16ToWav(
	pcm: Uint8Array,
	sampleRate = PCM16_SAMPLE_RATE,
	channels = PCM16_CHANNELS,
) {
	if (sampleRate <= 0 || channels <= 0) {
		throw new Error("Invalid PCM audio format");
	}
	const header = new ArrayBuffer(44);
	const view = new DataView(header);
	const write = (offset: number, text: string) => {
		for (let index = 0; index < text.length; index += 1) {
			view.setUint8(offset + index, text.charCodeAt(index));
		}
	};
	write(0, "RIFF");
	view.setUint32(4, 36 + pcm.byteLength, true);
	write(8, "WAVE");
	write(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * channels * 2, true);
	view.setUint16(32, channels * 2, true);
	view.setUint16(34, 16, true);
	write(36, "data");
	view.setUint32(40, pcm.byteLength, true);
	const wav = new Uint8Array(44 + pcm.byteLength);
	wav.set(new Uint8Array(header));
	wav.set(pcm, 44);
	return wav;
}

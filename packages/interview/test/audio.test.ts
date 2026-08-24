import assert from "node:assert/strict";
import test from "node:test";
import { pcm16DurationMs, pcm16Rms, pcm16ToWav } from "../src/audio";

test("creates a PCM16 WAV with accurate headers", () => {
	const pcm = new Uint8Array(3_200);
	const wav = pcm16ToWav(pcm);
	assert.equal(Buffer.from(wav.subarray(0, 4)).toString(), "RIFF");
	assert.equal(Buffer.from(wav.subarray(8, 12)).toString(), "WAVE");
	assert.equal(
		new DataView(wav.buffer, wav.byteOffset).getUint32(40, true),
		pcm.byteLength,
	);
	assert.equal(pcm16DurationMs(pcm), 100);
	assert.equal(pcm16Rms(pcm), 0);
});

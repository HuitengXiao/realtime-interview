import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";

const legacyPrefix = "pbkdf2_sha256:";

export async function verifyMigratedPassword(input: {
	hash: string;
	password: string;
}) {
	if (!input.hash.startsWith(legacyPrefix)) {
		return verifyPassword(input);
	}
	try {
		const [algorithm, iterationsValue, salt, expectedHex] =
			input.hash.split(":");
		if (
			algorithm !== "pbkdf2_sha256" ||
			!iterationsValue ||
			!salt ||
			!expectedHex
		) {
			return false;
		}
		const iterations = Number(iterationsValue);
		if (!Number.isInteger(iterations) || iterations < 100_000) {
			return false;
		}
		const expected = Buffer.from(expectedHex, "hex");
		const actual = pbkdf2Sync(
			input.password,
			salt,
			iterations,
			expected.byteLength,
			"sha256",
		);
		return expected.byteLength > 0 && timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

export const migratedPassword = {
	hash: hashPassword,
	verify: verifyMigratedPassword,
};

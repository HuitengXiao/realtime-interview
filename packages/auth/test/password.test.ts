import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";
import { hashPassword } from "better-auth/crypto";
import { verifyMigratedPassword } from "../password";

test("verifies FunASR PBKDF2 passwords", async () => {
	const password = "legacy-password";
	const salt = "0123456789abcdef0123456789abcdef";
	const digest = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString(
		"hex",
	);
	const hash = `pbkdf2_sha256:100000:${salt}:${digest}`;

	assert.equal(await verifyMigratedPassword({ hash, password }), true);
	assert.equal(
		await verifyMigratedPassword({ hash, password: "incorrect" }),
		false,
	);
});

test("continues to verify Better Auth Scrypt passwords", async () => {
	const password = "current-password";
	const hash = await hashPassword(password);
	assert.equal(await verifyMigratedPassword({ hash, password }), true);
});

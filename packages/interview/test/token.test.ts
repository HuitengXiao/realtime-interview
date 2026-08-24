import assert from "node:assert/strict";
import test from "node:test";
import {
	RealtimeTokenError,
	realtimeTokenExpiration,
	signRealtimeToken,
	verifyRealtimeToken,
} from "../src/token";

const env = { REALTIME_AUTH_SECRET: "test-secret" };
const payload = {
	userId: "user",
	organizationId: "org",
	interviewId: "interview",
	displayName: "Ada",
	canRecord: true,
	exp: 2_000_000_000,
};
test("signs and verifies realtime tokens", () =>
	assert.deepEqual(
		verifyRealtimeToken(signRealtimeToken(payload, env), env, 0),
		payload,
	));
test("realtime token failures have a stable error", () =>
	assert.throws(
		() => verifyRealtimeToken("bad.token", env),
		RealtimeTokenError,
	));
test("expired tokens are rejected", () =>
	assert.throws(
		() =>
			verifyRealtimeToken(
				signRealtimeToken({ ...payload, exp: 1 }, env),
				env,
				1_000,
			),
		RealtimeTokenError,
	));

test("realtime token lifetime covers the configured session plus shutdown buffer", () => {
	assert.equal(
		realtimeTokenExpiration(1_000, {
			INTERVIEW_MAX_SESSION_MINUTES: "120",
		}),
		1_000 + 125 * 60,
	);
	assert.equal(realtimeTokenExpiration(1_000, {}), 1_000 + 125 * 60);
});

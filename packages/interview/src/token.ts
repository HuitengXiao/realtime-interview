import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.object({
	userId: z.string().min(1),
	organizationId: z.string().min(1),
	interviewId: z.string().min(1),
	displayName: z.string().min(1).max(200),
	canRecord: z.boolean(),
	exp: z.number().int().positive(),
});
export type RealtimeTokenPayload = z.infer<typeof payloadSchema>;

export function realtimeTokenExpiration(
	nowSeconds = Math.floor(Date.now() / 1_000),
	env: NodeJS.ProcessEnv = process.env,
) {
	const configuredMinutes = Number(env.INTERVIEW_MAX_SESSION_MINUTES ?? 120);
	const sessionMinutes =
		Number.isFinite(configuredMinutes) && configuredMinutes > 0
			? configuredMinutes
			: 120;
	return nowSeconds + Math.ceil((sessionMinutes + 5) * 60);
}

export class RealtimeTokenError extends Error {
	constructor() {
		super("Invalid realtime token");
		this.name = "RealtimeTokenError";
	}
}

function secret(env: NodeJS.ProcessEnv) {
	const value = env.REALTIME_AUTH_SECRET || env.BETTER_AUTH_SECRET;
	if (!value) {
		throw new Error("Realtime authentication is not configured");
	}
	return value;
}
function encode(value: string) {
	return Buffer.from(value).toString("base64url");
}
function signature(input: string, signingSecret: string) {
	return createHmac("sha256", signingSecret)
		.update(input)
		.digest("base64url");
}

export function signRealtimeToken(
	payload: RealtimeTokenPayload,
	env: NodeJS.ProcessEnv = process.env,
) {
	const parsed = payloadSchema.parse(payload);
	const body = encode(JSON.stringify(parsed));
	return `${body}.${signature(body, secret(env))}`;
}

export function verifyRealtimeToken(
	token: string,
	env: NodeJS.ProcessEnv = process.env,
	now = Date.now(),
) {
	try {
		const [body, received, ...rest] = token.split(".");
		if (!body || !received || rest.length) {
			throw new RealtimeTokenError();
		}
		const expected = signature(body, secret(env));
		const left = Buffer.from(received);
		const right = Buffer.from(expected);
		if (left.length !== right.length || !timingSafeEqual(left, right)) {
			throw new RealtimeTokenError();
		}
		const parsed = payloadSchema.parse(
			JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
		);
		if (parsed.exp * 1000 <= now) {
			throw new RealtimeTokenError();
		}
		return parsed;
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "Realtime authentication is not configured"
		) {
			throw error;
		}
		throw new RealtimeTokenError();
	}
}

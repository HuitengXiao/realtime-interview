import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
	getInterviewAccess,
	listInterviewMessages,
	transferInterviewRoomOwnership,
} from "../src/repository";

test("shared interview messages are listed by room with author identity", async () => {
	let query: unknown;
	const expected = [
		{
			id: "message-1",
			interviewId: "shared-room",
			role: "user",
			content: "Ask the agent",
			author: { id: "member-1", name: "Member", email: "m@example.com" },
		},
	];
	const db = {
		interviewMessage: {
			findMany: async (args: unknown) => {
				query = args;
				return expected;
			},
		},
	} as unknown as PrismaClient;

	assert.equal(
		await listInterviewMessages(db, { interviewId: "shared-room" }),
		expected,
	);
	assert.deepEqual(query, {
		where: { interviewId: "shared-room" },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: 200,
		include: {
			author: { select: { id: true, name: true, email: true } },
		},
	});
});

test("shared interview messages support a stable incremental cursor", async () => {
	let query: unknown;
	const cursor = {
		createdAt: new Date("2026-08-24T08:00:00.000Z"),
		id: "m-1",
	};
	const db = {
		interviewMessage: {
			findMany: async (args: unknown) => {
				query = args;
				return [];
			},
		},
	} as unknown as PrismaClient;

	await listInterviewMessages(db, {
		interviewId: "shared-room",
		after: cursor,
	});
	assert.deepEqual(query, {
		where: {
			interviewId: "shared-room",
			OR: [
				{ createdAt: { gt: cursor.createdAt } },
				{ createdAt: cursor.createdAt, id: { gt: "m-1" } },
			],
		},
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		take: 200,
		include: {
			author: { select: { id: true, name: true, email: true } },
		},
	});
});

test("organization members can access shared rooms but cannot manage or record them", async () => {
	const db = {
		interviewRoom: {
			findUnique: async () => ({
				organizationId: "oneband",
				createdById: "another-user",
			}),
		},
		member: {
			findUnique: async () => ({ role: "member" }),
		},
	} as unknown as PrismaClient;

	assert.deepEqual(
		await getInterviewAccess(db, {
			userId: "organization-member",
			interviewId: "shared-room",
		}),
		{
			organizationId: "oneband",
			role: "member",
			isOwner: false,
			canManage: false,
			canRecord: false,
		},
	);
});

test("organization admins do not gain room management or recording access", async () => {
	const db = {
		interviewRoom: {
			findUnique: async () => ({
				organizationId: "oneband",
				createdById: "room-owner",
			}),
		},
		member: {
			findUnique: async () => ({ role: "admin" }),
		},
	} as unknown as PrismaClient;

	assert.deepEqual(
		await getInterviewAccess(db, {
			userId: "organization-admin",
			interviewId: "owned-room",
		}),
		{
			organizationId: "oneband",
			role: "admin",
			isOwner: false,
			canManage: false,
			canRecord: false,
		},
	);
});

test("transferring ownership requires a target organization member", async () => {
	const db = {
		$transaction: async (callback: (tx: unknown) => unknown) =>
			callback(db),
		interviewRoom: {
			findUnique: async () => ({ organizationId: "oneband" }),
			updateMany: async () => ({ count: 0 }),
		},
		member: {
			findUnique: async () => null,
		},
	} as unknown as PrismaClient;

	assert.deepEqual(
		await transferInterviewRoomOwnership(db, {
			interviewId: "room",
			currentOwnerId: "owner",
			newOwnerId: "outsider",
		}),
		{ status: "target-not-member" },
	);
});

test("transferring ownership rejects the current owner", async () => {
	const db = {} as PrismaClient;

	assert.deepEqual(
		await transferInterviewRoomOwnership(db, {
			interviewId: "room",
			currentOwnerId: "owner",
			newOwnerId: "owner",
		}),
		{ status: "same-owner" },
	);
});

test("transferring ownership conditionally updates the current owner", async () => {
	let updateWhere: unknown;
	const db = {
		$transaction: async (callback: (tx: unknown) => unknown) =>
			callback(db),
		interviewRoom: {
			findUnique: async () => ({ organizationId: "oneband" }),
			updateMany: async (args: { where: unknown }) => {
				updateWhere = args.where;
				return { count: 1 };
			},
		},
		member: {
			findUnique: async () => ({ userId: "new-owner" }),
		},
	} as unknown as PrismaClient;

	assert.deepEqual(
		await transferInterviewRoomOwnership(db, {
			interviewId: "room",
			currentOwnerId: "owner",
			newOwnerId: "new-owner",
		}),
		{ status: "transferred" },
	);
	assert.deepEqual(updateWhere, { id: "room", createdById: "owner" });
});

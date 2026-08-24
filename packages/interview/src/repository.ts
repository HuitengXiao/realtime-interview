import { Prisma, type PrismaClient } from "@prisma/client";
import { interviewStatusSchema, transcriptSegmentSchema } from "./types";

type Database = PrismaClient;
type Json = Prisma.InputJsonValue;

export async function listInterviewRooms(db: Database, organizationId: string) {
	return db.interviewRoom.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
		include: {
			createdBy: {
				select: { id: true, name: true, email: true, image: true },
			},
		},
	});
}
export async function createInterviewRoom(
	db: Database,
	input: {
		organizationId: string;
		createdById: string;
		title: string;
		intervieweeName?: string;
		status?: string;
		sourceLang?: string;
		targetLang?: string;
		translationEngine?: string;
		settings?: Json;
	},
) {
	return db.interviewRoom.create({
		data: {
			...input,
			status: interviewStatusSchema.parse(input.status ?? "draft"),
		},
	});
}
export async function getInterviewRoomBundle(
	db: Database,
	interviewId: string,
) {
	return db.interviewRoom.findUnique({
		where: { id: interviewId },
		include: {
			createdBy: {
				select: { id: true, name: true, email: true, image: true },
			},
			organization: {
				select: {
					members: {
						select: {
							role: true,
							user: {
								select: {
									id: true,
									name: true,
									email: true,
									image: true,
								},
							},
						},
					},
				},
			},
			notes: true,
			messages: {
				orderBy: { createdAt: "asc" },
				include: {
					author: { select: { id: true, name: true, email: true } },
				},
			},
			transcriptSegments: { orderBy: { startMs: "asc" } },
		},
	});
}

/**
 * Transfers a room to another member of the same organization. The conditional
 * update makes the ownership change safe if ownership changes concurrently.
 */
export async function transferInterviewRoomOwnership(
	db: Database,
	input: { interviewId: string; currentOwnerId: string; newOwnerId: string },
) {
	if (input.currentOwnerId === input.newOwnerId) {
		return { status: "same-owner" as const };
	}
	return db.$transaction(async (tx) => {
		const room = await tx.interviewRoom.findUnique({
			where: { id: input.interviewId },
			select: { organizationId: true },
		});
		if (!room) {
			return { status: "not-found" as const };
		}

		const targetMembership = await tx.member.findUnique({
			where: {
				userId_organizationId: {
					userId: input.newOwnerId,
					organizationId: room.organizationId,
				},
			},
			select: { userId: true },
		});
		if (!targetMembership) {
			return { status: "target-not-member" as const };
		}

		const updated = await tx.interviewRoom.updateMany({
			where: { id: input.interviewId, createdById: input.currentOwnerId },
			data: { createdById: input.newOwnerId },
		});
		return updated.count === 1
			? { status: "transferred" as const }
			: { status: "not-owner" as const };
	});
}
export async function updateInterviewRoom(
	db: Database,
	interviewId: string,
	ownerId: string,
	input: {
		title?: string;
		intervieweeName?: string | null;
		status?: string;
		sourceLang?: string;
		targetLang?: string;
		translationEngine?: string | null;
		settings?: Json | null;
	},
) {
	const { settings, status, ...fields } = input;
	const updated = await db.interviewRoom.updateMany({
		where: { id: interviewId, createdById: ownerId },
		data: {
			...fields,
			...(status ? { status: interviewStatusSchema.parse(status) } : {}),
			...(settings === null
				? { settings: Prisma.JsonNull }
				: settings === undefined
					? {}
					: { settings }),
		},
	});
	return updated.count === 1
		? db.interviewRoom.findUnique({ where: { id: interviewId } })
		: null;
}
export async function deleteInterviewRoom(
	db: Database,
	interviewId: string,
	ownerId: string,
) {
	const deleted = await db.interviewRoom.deleteMany({
		where: { id: interviewId, createdById: ownerId },
	});
	return deleted.count === 1;
}

export async function getInterviewAccess(
	db: Database,
	input: { userId: string; interviewId: string },
) {
	const room = await db.interviewRoom.findUnique({
		where: { id: input.interviewId },
		select: { organizationId: true, createdById: true },
	});
	if (!room) {
		return null;
	}
	const membership = await db.member.findUnique({
		where: {
			userId_organizationId: {
				userId: input.userId,
				organizationId: room.organizationId,
			},
		},
		select: { role: true },
	});
	if (!membership) {
		return null;
	}
	const isOwner = room.createdById === input.userId;
	return {
		organizationId: room.organizationId,
		role: membership.role,
		isOwner,
		canManage: isOwner,
		canRecord: isOwner,
	};
}

export async function upsertFinalTranscriptSegment(
	db: Database,
	interviewId: string,
	input: Parameters<typeof transcriptSegmentSchema.parse>[0],
) {
	const segment = transcriptSegmentSchema.parse(input);
	return db.interviewTranscriptSegment.upsert({
		where: {
			interviewId_segmentKey: {
				interviewId,
				segmentKey: segment.segmentKey,
			},
		},
		create: {
			interviewId,
			...segment,
			metadata: segment.metadata as Json | undefined,
			isFinal: true,
		},
		update: {
			speaker: segment.speaker,
			startMs: segment.startMs,
			endMs: segment.endMs,
			text: segment.text,
			language: segment.language,
			sourceLang: segment.sourceLang,
			targetLang: segment.targetLang,
			translationEngine: segment.translationEngine,
			metadata: segment.metadata as Json | undefined,
			isFinal: true,
			...(segment.translation?.trim()
				? { translation: segment.translation.trim() }
				: {}),
		},
	});
}
export async function addInterviewMessage(
	db: Database,
	input: {
		interviewId: string;
		authorId?: string;
		role: string;
		content: string;
		metadata?: Json;
	},
) {
	return db.interviewMessage.create({ data: input });
}

export async function listInterviewMessages(
	db: Database,
	input: {
		interviewId: string;
		after?: { createdAt: Date; id: string };
		limit?: number;
	},
) {
	const limit = Math.min(Math.max(input.limit ?? 200, 1), 200);
	const messages = await db.interviewMessage.findMany({
		where: {
			interviewId: input.interviewId,
			...(input.after
				? {
						OR: [
							{ createdAt: { gt: input.after.createdAt } },
							{
								createdAt: input.after.createdAt,
								id: { gt: input.after.id },
							},
						],
					}
				: {}),
		},
		orderBy: input.after
			? [{ createdAt: "asc" }, { id: "asc" }]
			: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit,
		include: {
			author: { select: { id: true, name: true, email: true } },
		},
	});
	return input.after ? messages : messages.reverse();
}

export async function saveInterviewNotes(
	db: Database,
	input: { interviewId: string; content: string; updatedById?: string },
) {
	return db.interviewNotes.upsert({
		where: { interviewId: input.interviewId },
		create: input,
		update: { content: input.content, updatedById: input.updatedById },
	});
}

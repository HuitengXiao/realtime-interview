import { type Prisma, PrismaClient } from "@prisma/client";
import { Client } from "pg";

const apply = process.argv.includes("--apply");
const organizationId =
	process.env.FUNASR_TARGET_ORGANIZATION_ID || "seed-organization";
const defaultOwnerEmail =
	process.env.ONEBAND_DEFAULT_OWNER_EMAIL?.toLowerCase();
const funasrUrl = process.env.FUNASR_SOURCE_DATABASE_URL;
const onebandUrl = process.env.ONEBAND_SOURCE_DATABASE_URL;

if (!funasrUrl || !onebandUrl) {
	throw new Error(
		"FUNASR_SOURCE_DATABASE_URL and ONEBAND_SOURCE_DATABASE_URL are required",
	);
}

if (!defaultOwnerEmail) {
	throw new Error("ONEBAND_DEFAULT_OWNER_EMAIL is required");
}

const sourceConnection = (connectionString: string) => {
	const url = new URL(connectionString);
	if (url.searchParams.get("sslmode") === "prefer") {
		url.searchParams.delete("sslmode");
		return { connectionString: url.toString(), ssl: false as const };
	}
	return { connectionString };
};

const db = new PrismaClient();
const funasr = new Client(sourceConnection(funasrUrl));
const oneband = new Client(sourceConnection(onebandUrl));

type Row = Record<string, any>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const object = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

function noteContent(blocks: unknown) {
	if (!Array.isArray(blocks)) {
		return typeof blocks === "string"
			? blocks
			: JSON.stringify(blocks ?? []);
	}
	return blocks
		.map((block) => {
			if (!block || typeof block !== "object") {
				return String(block ?? "");
			}
			const item = block as Record<string, unknown>;
			const content = String(item.content ?? "");
			if (item.type === "checklist") {
				return `- [${item.checked ? "x" : " "}] ${content}`;
			}
			return content;
		})
		.filter(Boolean)
		.join("\n");
}

function chunks<T>(values: T[], size = 100) {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		result.push(values.slice(index, index + size));
	}
	return result;
}

async function rows(client: Client, query: string, values: unknown[] = []) {
	return (await client.query(query, values)).rows as Row[];
}

async function main() {
	await Promise.all([funasr.connect(), oneband.connect()]);

	const [organization] = await rows(
		oneband,
		"SELECT * FROM organization WHERE id = $1",
		[organizationId],
	);
	if (!organization) {
		throw new Error(`Oneband organization ${organizationId} was not found`);
	}
	const members = await rows(
		oneband,
		'SELECT * FROM member WHERE "organizationId" = $1 ORDER BY "createdAt"',
		[organizationId],
	);
	if (!members.length) {
		throw new Error("The target oneband organization has no members");
	}
	const funUsers = await rows(funasr, "SELECT * FROM app_users");
	const rooms = await rows(funasr, "SELECT * FROM interview_rooms");
	const messages = await rows(funasr, "SELECT * FROM room_messages");
	const notes = await rows(funasr, "SELECT * FROM room_notes");
	const segments = await rows(
		funasr,
		"SELECT * FROM room_transcript_segments ORDER BY room_id, start_ms, id",
	);
	const onebandUsers = await rows(oneband, 'SELECT * FROM "user"');
	const registeredFunUsers = funUsers.filter(
		(user) => user.email && user.password_hash && user.email_verified_at,
	);
	const onebandEmailSet = new Set(
		onebandUsers.map((user) => String(user.email).toLowerCase()),
	);
	const importedFunUsers = registeredFunUsers
		.filter(
			(user) => !onebandEmailSet.has(String(user.email).toLowerCase()),
		)
		.map((user) => ({
			id: `funasr-${user.id}`,
			name: user.display_name || user.username || user.email,
			email: user.email,
			emailVerified: true,
			image: null,
			createdAt: user.created_at,
			updatedAt: user.last_seen_at || user.created_at,
			username: user.username,
			role: null,
			banned: false,
			banReason: null,
			banExpires: null,
			onboardingComplete: true,
			paymentsCustomerId: null,
			locale: null,
			legacyPassword: user.password_hash as string,
		}));
	const effectiveUsers = [...onebandUsers, ...importedFunUsers];
	const onebandUserIds = onebandUsers.map((user) => user.id);
	const onebandAccounts = await rows(
		oneband,
		'SELECT * FROM account WHERE "userId" = ANY($1::text[])',
		[onebandUserIds],
	);
	const importedAccounts = importedFunUsers.map((user) => ({
		id: `funasr-credential-${user.id}`,
		accountId: user.id,
		providerId: "credential",
		userId: user.id,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		expiresAt: null,
		password: user.legacyPassword,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		scope: null,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	}));
	const accounts = [...onebandAccounts, ...importedAccounts];
	const passkeys = await rows(
		oneband,
		'SELECT * FROM passkey WHERE "userId" = ANY($1::text[])',
		[onebandUserIds],
	);
	const invitations = await rows(
		oneband,
		'SELECT * FROM invitation WHERE "organizationId" = $1',
		[organizationId],
	);
	const registeredFunEmails = new Set(
		registeredFunUsers
			.map((user) => user.email && String(user.email).toLowerCase())
			.filter(Boolean),
	);
	const existingMemberUserIds = new Set(
		members.map((member) => member.userId),
	);
	const inferredMembers = effectiveUsers
		.filter(
			(user) =>
				registeredFunEmails.has(String(user.email).toLowerCase()) &&
				!existingMemberUserIds.has(user.id),
		)
		.map((user) => ({
			id: `funasr-import-${organizationId}-${user.id}`,
			organizationId,
			userId: user.id,
			role: "member",
			createdAt: user.createdAt,
		}));
	const defaultOwner = effectiveUsers.find(
		(user) => String(user.email).toLowerCase() === defaultOwnerEmail,
	);
	const effectiveMembers = [...members, ...inferredMembers].map((member) =>
		defaultOwner && member.userId === defaultOwner.id
			? { ...member, role: "owner" }
			: member,
	);

	const managers = effectiveMembers.filter((member) =>
		["owner", "admin"].includes(member.role),
	);
	const fallbackCreatorId = (managers[0] ?? members[0]).userId as string;
	const targetUserByEmail = new Map(
		effectiveUsers.map((user) => [String(user.email).toLowerCase(), user]),
	);
	const funUserById = new Map(funUsers.map((user) => [user.id, user]));
	const mappedTargetUser = (funUserId: string | null) => {
		const user = funUserId ? funUserById.get(funUserId) : undefined;
		return user?.email
			? targetUserByEmail.get(String(user.email).toLowerCase())
			: undefined;
	};
	const mappedCreators = rooms.filter((room) =>
		Boolean(mappedTargetUser(room.created_by)),
	).length;

	const summary = {
		mode: apply ? "apply" : "dry-run",
		organization: {
			id: organization.id,
			name: organization.name,
			members: effectiveMembers.length,
			existingMembers: members.length,
			inferredFunASRMembers: inferredMembers.length,
		},
		oneband: {
			users: effectiveUsers.length,
			existingUsers: onebandUsers.length,
			importedFunASRUsers: importedFunUsers.length,
			accounts: accounts.length,
			passkeys: passkeys.length,
			invitations: invitations.length,
		},
		funasr: {
			users: funUsers.length,
			registeredUsers: registeredFunUsers.length,
			rooms: rooms.length,
			messages: messages.length,
			notes: notes.length,
			segments: segments.length,
			mappedCreators,
			fallbackCreators: rooms.length - mappedCreators,
		},
	};
	console.info(JSON.stringify(summary, null, 2));
	if (!apply) {
		return;
	}

	await db.$transaction(
		async (tx) => {
			for (const user of effectiveUsers) {
				const data = {
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
					username: user.username,
					role: user.role,
					banned: user.banned,
					banReason: user.banReason,
					banExpires: user.banExpires,
					onboardingComplete: user.onboardingComplete,
					paymentsCustomerId: user.paymentsCustomerId,
					locale: user.locale,
				};
				await tx.user.upsert({
					where: { id: user.id },
					create: data,
					update: data,
				});
			}
			const organizationData = {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
				createdAt: organization.createdAt,
				metadata: organization.metadata,
				paymentsCustomerId: organization.paymentsCustomerId,
			};
			await tx.organization.upsert({
				where: { id: organization.id },
				create: organizationData,
				update: organizationData,
			});
			for (const member of effectiveMembers) {
				const data = {
					id: member.id,
					organizationId: member.organizationId,
					userId: member.userId,
					role: member.role,
					createdAt: member.createdAt,
				};
				await tx.member.upsert({
					where: { id: member.id },
					create: data,
					update: data,
				});
			}
			for (const account of accounts) {
				const data = {
					id: account.id,
					accountId: account.accountId,
					providerId: account.providerId,
					userId: account.userId,
					accessToken: account.accessToken,
					refreshToken: account.refreshToken,
					idToken: account.idToken,
					expiresAt: account.expiresAt,
					password: account.password,
					accessTokenExpiresAt: account.accessTokenExpiresAt,
					refreshTokenExpiresAt: account.refreshTokenExpiresAt,
					scope: account.scope,
					createdAt: account.createdAt,
					updatedAt: account.updatedAt,
				};
				await tx.account.upsert({
					where: { id: account.id },
					create: data,
					update: data,
				});
			}
			for (const passkey of passkeys) {
				const data = {
					id: passkey.id,
					name: passkey.name,
					publicKey: passkey.publicKey,
					userId: passkey.userId,
					credentialID: passkey.credentialID,
					counter: passkey.counter,
					deviceType: passkey.deviceType,
					backedUp: passkey.backedUp,
					transports: passkey.transports,
					createdAt: passkey.createdAt,
				};
				await tx.passkey.upsert({
					where: { id: passkey.id },
					create: data,
					update: data,
				});
			}
			for (const invitation of invitations) {
				const data = {
					id: invitation.id,
					organizationId: invitation.organizationId,
					email: invitation.email,
					role: invitation.role,
					status: invitation.status,
					expiresAt: invitation.expiresAt,
					inviterId: invitation.inviterId,
				};
				await tx.invitation.upsert({
					where: { id: invitation.id },
					create: data,
					update: data,
				});
			}
		},
		{ timeout: 60_000 },
	);

	for (const room of rooms) {
		const legacyCreator = funUserById.get(room.created_by);
		const creatorId =
			mappedTargetUser(room.created_by)?.id ?? fallbackCreatorId;
		const legacySettings = object(room.settings);
		const settings = {
			...legacySettings,
			migration: {
				source: "funASR",
				legacyCreatorId: room.created_by,
				legacyCreatorName: legacyCreator?.display_name,
				legacyCreatorEmail: legacyCreator?.email,
			},
		};
		const data = {
			organizationId,
			createdById: creatorId,
			title: room.title,
			intervieweeName: room.interviewee_name,
			sourceLang: ["auto", "zh", "en"].includes(
				String(legacySettings.sourceLang),
			)
				? String(legacySettings.sourceLang)
				: "auto",
			targetLang: ["auto", "zh", "en"].includes(
				String(legacySettings.targetLang),
			)
				? String(legacySettings.targetLang)
				: "auto",
			translationEngine: ["auto", "cloud"].includes(
				String(legacySettings.translationEngine),
			)
				? String(legacySettings.translationEngine)
				: null,
			status: ["draft", "active", "completed", "archived"].includes(
				room.status,
			)
				? room.status
				: "active",
			settings: json(settings),
			createdAt: room.created_at,
			updatedAt: room.updated_at,
		};
		await db.interviewRoom.upsert({
			where: { id: room.id },
			create: { id: room.id, ...data },
			update: data,
		});
	}

	for (const batch of chunks(messages)) {
		await db.$transaction(
			batch.map((message) => {
				const author = mappedTargetUser(message.user_id);
				const data = {
					interviewId: message.room_id,
					authorId: author?.id,
					role: message.role || "user",
					content: message.content,
					metadata: json({
						source: "funASR",
						legacyUserId: message.user_id,
						legacyDisplayName: message.display_name,
						agentId: message.agent_id,
						agentName: message.agent_name,
					}),
					createdAt: message.created_at,
				};
				return db.interviewMessage.upsert({
					where: { id: message.id },
					create: { id: message.id, ...data },
					update: data,
				});
			}),
		);
	}

	for (const note of notes) {
		const editor = mappedTargetUser(note.updated_by);
		const data = {
			content: noteContent(note.blocks),
			updatedById: editor?.id,
			updatedAt: note.updated_at,
		};
		await db.interviewNotes.upsert({
			where: { interviewId: note.room_id },
			create: { interviewId: note.room_id, ...data },
			update: data,
		});
	}

	for (const batch of chunks(segments)) {
		await db.$transaction(
			batch.map((segment) => {
				const data = {
					interviewId: segment.room_id,
					segmentKey: segment.segment_key,
					speaker: segment.speaker,
					startMs: segment.start_ms,
					endMs: segment.end_ms,
					text: segment.text,
					translation: segment.translation,
					language: segment.source_lang,
					sourceLang: segment.source_lang,
					targetLang: segment.target_lang,
					translationEngine: segment.translation_engine,
					isFinal: true,
					metadata: json({
						source: "funASR",
						legacySegmentId: String(segment.id),
					}),
					createdAt: segment.created_at,
					updatedAt: segment.updated_at,
				};
				return db.interviewTranscriptSegment.upsert({
					where: {
						interviewId_segmentKey: {
							interviewId: segment.room_id,
							segmentKey: segment.segment_key,
						},
					},
					create: data,
					update: data,
				});
			}),
		);
	}

	console.info("FunASR migration completed successfully");
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await Promise.allSettled([
			funasr.end(),
			oneband.end(),
			db.$disconnect(),
		]);
	});

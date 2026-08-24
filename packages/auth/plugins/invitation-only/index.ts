import { db } from "@repo/database";
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/plugins";

export const invitationOnlyPlugin = () =>
	({
		id: "invitationOnlyPlugin",
		hooks: {
			before: [
				{
					matcher: (context) =>
						context.path.startsWith("/organization/remove-member"),
					handler: createAuthMiddleware(async (ctx) => {
						const organizationId = ctx.body.organizationId;
						const memberIdOrEmail = ctx.body.memberIdOrEmail;
						if (!organizationId || !memberIdOrEmail) {
							return;
						}

						const targetMember = await db.member.findFirst({
							where: {
								organizationId,
								OR: [
									{ id: memberIdOrEmail },
									{
										user: {
											email: {
												equals: memberIdOrEmail,
												mode: "insensitive",
											},
										},
									},
								],
							},
						});
						if (
							targetMember?.role === "owner" &&
							(await db.member.count({
								where: { organizationId, role: "owner" },
							})) <= 1
						) {
							throw new APIError("BAD_REQUEST", {
								code: "ORGANIZATION_REQUIRES_OWNER",
								message:
									"An organization must keep at least one owner",
							});
						}
					}),
				},
				{
					matcher: (context) =>
						context.path.startsWith("/organization/add-member") ||
						context.path.startsWith(
							"/organization/invite-member",
						) ||
						context.path.startsWith(
							"/organization/update-member-role",
						),
					handler: createAuthMiddleware(async (ctx) => {
						if (!["owner", "member"].includes(ctx.body.role)) {
							throw new APIError("BAD_REQUEST", {
								code: "INVALID_ORGANIZATION_ROLE",
								message:
									"Organization role must be owner or member",
							});
						}

						if (
							ctx.path.startsWith(
								"/organization/update-member-role",
							)
						) {
							const targetMember = await db.member.findFirst({
								where: {
									id: ctx.body.memberId,
									organizationId: ctx.body.organizationId,
								},
							});

							if (!targetMember) {
								throw new APIError("BAD_REQUEST", {
									code: "INVALID_ORGANIZATION_MEMBER",
									message:
										"Member does not belong to this organization",
								});
							}

							if (
								targetMember.role === "owner" &&
								ctx.body.role === "member" &&
								(await db.member.count({
									where: {
										organizationId: ctx.body.organizationId,
										role: "owner",
									},
								})) <= 1
							) {
								throw new APIError("BAD_REQUEST", {
									code: "ORGANIZATION_REQUIRES_OWNER",
									message:
										"An organization must keep at least one owner",
								});
							}
						}
					}),
				},
				{
					matcher: (context) =>
						context.path.startsWith("/sign-up/email"),
					handler: createAuthMiddleware(async (ctx) => {
						const { email } = ctx.body;
						const invitationCode =
							typeof ctx.body.invitationCode === "string"
								? ctx.body.invitationCode.trim().toUpperCase()
								: "";

						const now = new Date();
						const hasRegistrationInviteCode = invitationCode
							? await db.registrationInviteCode.count({
									where: {
										code: invitationCode,
										revoked: false,
										expiresAt: { gt: now },
									},
								})
							: 0;

						if (hasRegistrationInviteCode) {
							return;
						}

						// A pending, unexpired organization invitation for this email
						// is also a valid path into the product.
						const invitationId =
							typeof ctx.body.invitationId === "string"
								? ctx.body.invitationId
								: "";
						const hasInvitation = invitationId
							? await db.invitation.count({
									where: {
										id: invitationId,
										email: {
											equals: email,
											mode: "insensitive",
										},
										status: "pending",
										expiresAt: { gt: now },
									},
								})
							: 0;

						if (!hasInvitation) {
							throw new APIError("BAD_REQUEST", {
								code: invitationCode
									? "INVALID_INVITATION_CODE"
									: "INVITATION_CODE_REQUIRED",
								message:
									"A valid invitation code or organization invitation is required",
							});
						}
					}),
				},
			],
			after: [
				{
					matcher: (context) =>
						context.path.startsWith("/sign-up/email"),
					handler: createAuthMiddleware(async (ctx) => {
						if (ctx.context.returned instanceof APIError) {
							return;
						}

						const invitationCode =
							typeof ctx.body.invitationCode === "string"
								? ctx.body.invitationCode.trim().toUpperCase()
								: "";

						if (!invitationCode) {
							return;
						}

						await db.registrationInviteCode.updateMany({
							where: {
								code: invitationCode,
							},
							data: {
								usageCount: { increment: 1 },
								lastUsedAt: new Date(),
							},
						});
					}),
				},
			],
		},
		$ERROR_CODES: {
			INVALID_INVITATION:
				"A valid invitation code or organization invitation is required",
			INVITATION_CODE_REQUIRED: "An invitation code is required",
			INVALID_INVITATION_CODE:
				"The invitation code is invalid, revoked, or expired",
			INVALID_ORGANIZATION_ROLE:
				"Organization role must be owner or member",
			INVALID_ORGANIZATION_MEMBER:
				"Member does not belong to this organization",
			ORGANIZATION_REQUIRES_OWNER:
				"An organization must keep at least one owner",
		},
	}) satisfies BetterAuthPlugin;

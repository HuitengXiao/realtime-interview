import { db } from "@repo/database";
import slugify from "@sindresorhus/slugify";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import { verifyOrganizationMembership } from "./lib/membership";

const expiresInHoursSchema = z.object({
	expiresInHours: z
		.number()
		.finite()
		.positive()
		.max(24 * 365),
});

const updateJoinCodeSchema = z.object({
	revoked: z.boolean(),
});

const joinByCodeSchema = z.object({
	code: z.string().trim().min(1).max(128),
});

async function requireOrganizationOwner(
	organizationId: string,
	userId: string,
) {
	const membership = await verifyOrganizationMembership(
		organizationId,
		userId,
	);
	if (membership.role !== "owner") {
		throw new HTTPException(403, {
			message: "Only the organization owner can manage join codes",
		});
	}

	return membership.organization;
}

export const organizationsRouter = new Hono()
	.basePath("/organizations")
	.get(
		"/generate-slug",
		validator(
			"query",
			z.object({
				name: z.string(),
			}),
		),
		describeRoute({
			summary: "Generate a slug for an organization",
			tags: ["Organizations"],
		}),
		async (c) => {
			const { name } = c.req.valid("query");

			const baseSlug = slugify(name, {
				lowercase: true,
			});

			let slug = baseSlug;
			let hasAvailableSlug = false;

			for (let i = 0; i < 3; i++) {
				const existing = await db.organization.findUnique({
					where: {
						slug,
					},
				});

				if (!existing) {
					hasAvailableSlug = true;
					break;
				}

				slug = `${baseSlug}-${nanoid(5)}`;
			}

			if (!hasAvailableSlug) {
				return c.json(
					{
						error: "No available slug found",
					},
					400,
				);
			}

			return c.json({
				slug,
			});
		},
	)
	.use(authMiddleware)
	.get("/:organizationId/join-codes", async (c) => {
		const organizationId = c.req.param("organizationId");
		await requireOrganizationOwner(organizationId, c.get("user").id);

		const joinCodes = await db.organizationJoinCode.findMany({
			where: { organizationId },
			orderBy: { createdAt: "desc" },
		});

		return c.json({ joinCodes });
	})
	.post(
		"/:organizationId/join-codes",
		validator("json", expiresInHoursSchema),
		async (c) => {
			const organizationId = c.req.param("organizationId");
			const user = c.get("user");
			await requireOrganizationOwner(organizationId, user.id);
			const { expiresInHours } = c.req.valid("json");

			const joinCode = await db.organizationJoinCode.create({
				data: {
					organizationId,
					code: `TEAM-${nanoid(16)}`.toUpperCase(),
					expiresAt: new Date(
						Date.now() + expiresInHours * 60 * 60 * 1000,
					),
					createdById: user.id,
				},
			});

			return c.json({ joinCode }, 201);
		},
	)
	.patch(
		"/:organizationId/join-codes/:id",
		validator("json", updateJoinCodeSchema),
		async (c) => {
			const organizationId = c.req.param("organizationId");
			await requireOrganizationOwner(organizationId, c.get("user").id);
			const joinCode = await db.organizationJoinCode.findFirst({
				where: { id: c.req.param("id"), organizationId },
			});
			if (!joinCode) {
				throw new HTTPException(404, {
					message: "Join code not found",
				});
			}

			return c.json({
				joinCode: await db.organizationJoinCode.update({
					where: { id: joinCode.id },
					data: c.req.valid("json"),
				}),
			});
		},
	)
	.post("/join-by-code", validator("json", joinByCodeSchema), async (c) => {
		const user = c.get("user");
		const code = c.req.valid("json").code.toUpperCase();

		try {
			const organization = await db.$transaction(async (tx) => {
				const now = new Date();
				const joinCode = await tx.organizationJoinCode.findFirst({
					where: { code, revoked: false, expiresAt: { gt: now } },
					include: { organization: true },
				});
				if (!joinCode) {
					throw new HTTPException(400, {
						message: "Join code is invalid or expired",
					});
				}

				const existingMembership = await tx.member.findUnique({
					where: {
						userId_organizationId: {
							userId: user.id,
							organizationId: joinCode.organizationId,
						},
					},
				});
				if (existingMembership) {
					return joinCode.organization;
				}

				await tx.member.create({
					data: {
						id: nanoid(),
						organizationId: joinCode.organizationId,
						userId: user.id,
						role: "member",
						createdAt: now,
					},
				});

				const updatedCode = await tx.organizationJoinCode.updateMany({
					where: {
						id: joinCode.id,
						revoked: false,
						expiresAt: { gt: now },
					},
					data: { usageCount: { increment: 1 }, lastUsedAt: now },
				});
				if (updatedCode.count !== 1) {
					throw new HTTPException(400, {
						message: "Join code is invalid or expired",
					});
				}

				return joinCode.organization;
			});

			return c.json({ organization });
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "P2002"
			) {
				const joinCode = await db.organizationJoinCode.findUnique({
					where: { code },
					select: { organizationId: true },
				});
				const membership = joinCode
					? await db.member.findUnique({
							where: {
								userId_organizationId: {
									userId: user.id,
									organizationId: joinCode.organizationId,
								},
							},
							include: { organization: true },
						})
					: null;
				if (membership) {
					return c.json({ organization: membership.organization });
				}
			}

			throw error;
		}
	});

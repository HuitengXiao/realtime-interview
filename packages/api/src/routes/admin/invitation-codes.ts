import { db } from "@repo/database";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { adminMiddleware } from "../../middleware/admin";

const expiresInHoursSchema = z.object({
	expiresInHours: z
		.number()
		.finite()
		.positive()
		.max(24 * 365),
});

export const invitationCodeRouter = new Hono()
	.basePath("/invitation-codes")
	.use(adminMiddleware)
	.get(
		"/",
		describeRoute({
			summary: "List registration invitation codes",
			tags: ["Administration"],
		}),
		async (c) => {
			const invitationCodes = await db.registrationInviteCode.findMany({
				orderBy: { createdAt: "desc" },
			});

			return c.json({ invitationCodes });
		},
	)
	.post(
		"/",
		validator("json", expiresInHoursSchema),
		describeRoute({
			summary: "Create a registration invitation code",
			tags: ["Administration"],
		}),
		async (c) => {
			const { expiresInHours } = c.req.valid("json");
			const createdById = c.get("user").id;
			const expiresAt = new Date(
				Date.now() + expiresInHours * 60 * 60 * 1000,
			);

			const invitationCode = await db.registrationInviteCode.create({
				data: {
					code: `INV-${nanoid(16)}`.toUpperCase(),
					expiresAt,
					createdById,
				},
			});

			return c.json({ invitationCode }, 201);
		},
	)
	.patch(
		"/:id",
		validator("json", z.object({ revoked: z.boolean() })),
		describeRoute({
			summary: "Revoke or restore a registration invitation code",
			tags: ["Administration"],
		}),
		async (c) => {
			const { revoked } = c.req.valid("json");
			const invitationCode = await db.registrationInviteCode.update({
				where: { id: c.req.param("id") },
				data: { revoked },
			});

			return c.json({ invitationCode });
		},
	);

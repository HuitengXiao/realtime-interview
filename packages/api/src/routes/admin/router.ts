import { Hono } from "hono";
import { invitationCodeRouter } from "./invitation-codes";
import { organizationRouter } from "./organizations";
import { userRouter } from "./users";

export const adminRouter = new Hono()
	.basePath("/admin")
	.route("/", invitationCodeRouter)
	.route("/", organizationRouter)
	.route("/", userRouter);

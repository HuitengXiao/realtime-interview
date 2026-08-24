import type { ActiveOrganization } from "../auth";

export function isOrganizationOwner(
	organization?: ActiveOrganization | null,
	user?: {
		id: string;
	} | null,
) {
	const userOrganizationRole = organization?.members.find(
		(member) => member.userId === user?.id,
	)?.role;

	return userOrganizationRole === "owner";
}

import type { OrganizationMemberRole } from "@repo/auth";
import { useTranslations } from "next-intl";

export function useOrganizationMemberRoles() {
	const t = useTranslations();

	return {
		member: t("organizations.roles.member"),
		owner: t("organizations.roles.owner"),
	} satisfies Record<OrganizationMemberRole, string>;
}

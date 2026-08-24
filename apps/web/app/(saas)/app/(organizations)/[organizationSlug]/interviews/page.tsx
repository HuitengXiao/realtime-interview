import { getActiveOrganization } from "@saas/auth/lib/server";
import { InterviewList } from "@saas/interviews/components/InterviewList";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { notFound } from "next/navigation";

export default async function InterviewsPage({
	params,
}: { params: Promise<{ organizationSlug: string }> }) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);
	if (!organization) {
		notFound();
	}

	return (
		<>
			<PageHeader
				title="用户访谈"
				subtitle="创建访谈房间，实时记录、翻译并整理洞察。"
			/>
			<InterviewList
				organizationId={organization.id}
				organizationSlug={organizationSlug}
			/>
		</>
	);
}

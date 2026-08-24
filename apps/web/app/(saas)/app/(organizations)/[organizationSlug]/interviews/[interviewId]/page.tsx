import { getActiveOrganization } from "@saas/auth/lib/server";
import { RealtimeInterviewStudio } from "@saas/interviews/components/RealtimeInterviewStudio";
import { notFound } from "next/navigation";

export default async function InterviewRoomPage({
	params,
}: { params: Promise<{ organizationSlug: string; interviewId: string }> }) {
	const { organizationSlug, interviewId } = await params;
	if (!(await getActiveOrganization(organizationSlug))) {
		notFound();
	}
	return (
		<RealtimeInterviewStudio
			interviewId={interviewId}
			organizationSlug={organizationSlug}
		/>
	);
}

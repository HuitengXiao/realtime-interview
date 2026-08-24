"use client";

import {
	organizationListQueryKey,
	useJoinOrganizationByCodeMutation,
} from "@saas/organizations/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Input } from "@ui/components/input";
import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function JoinOrganizationByCodeForm() {
	const t = useTranslations("organizations.joinByCode");
	const router = useRouter();
	const queryClient = useQueryClient();
	const join = useJoinOrganizationByCodeMutation();
	const [code, setCode] = useState("");

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		try {
			const result = await join.mutateAsync(code);
			await queryClient.invalidateQueries({
				queryKey: organizationListQueryKey,
			});
			toast.success(t("success"));
			setCode("");
			if (result.organization.slug) {
				router.push(`/app/${result.organization.slug}`);
			}
		} catch {
			toast.error(t("error"));
		}
	};

	return (
		<Card className="mt-4 border p-4 shadow-none">
			<form
				onSubmit={submit}
				className="flex flex-col gap-3 sm:flex-row sm:items-end"
			>
				<label htmlFor="organization-join-code" className="flex-1 text-sm">
					<span className="mb-2 flex items-center gap-2 font-medium">
						<KeyRoundIcon className="size-4" />
						{t("title")}
					</span>
					<Input
						id="organization-join-code"
						value={code}
						onChange={(event) =>
							setCode(event.target.value.toUpperCase())
						}
						placeholder={t("placeholder")}
						required
						className="uppercase"
					/>
				</label>
				<Button loading={join.isPending}>{t("submit")}</Button>
			</form>
		</Card>
	);
}

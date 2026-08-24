"use client";

import {
	organizationJoinCodesQueryKey,
	useCreateOrganizationJoinCodeMutation,
	useOrganizationJoinCodesQuery,
	useUpdateOrganizationJoinCodeMutation,
} from "@saas/organizations/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { CopyIcon, PowerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export function OrganizationJoinCodes({
	organizationId,
}: { organizationId: string }) {
	const t = useTranslations("organizations.joinCodes");
	const queryClient = useQueryClient();
	const { data, isLoading } = useOrganizationJoinCodesQuery(organizationId);
	const createCode = useCreateOrganizationJoinCodeMutation(organizationId);
	const updateCode = useUpdateOrganizationJoinCodeMutation(organizationId);
	const [days, setDays] = useState(7);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: organizationJoinCodesQueryKey(organizationId),
		});

	const copy = async (code: string) => {
		await navigator.clipboard.writeText(code);
		toast.success(t("copied"));
	};

	const generate = async () => {
		try {
			const result = await createCode.mutateAsync(days * 24);
			await refresh();
			await copy(result.joinCode.code);
			toast.success(t("created"));
		} catch {
			toast.error(t("error"));
		}
	};

	return (
		<SettingsItem title={t("generate")} description={t("description")}>
			<div className="space-y-4">
				<div className="flex max-w-md items-end gap-2">
					<label htmlFor="join-code-validity-days" className="flex-1 text-sm">
						<span className="mb-2 block font-medium">
							{t("validityDays")}
						</span>
						<Input
							id="join-code-validity-days"
							type="number"
							min={1}
							max={365}
							value={days}
							onChange={(event) =>
								setDays(
									Math.min(
										365,
										Math.max(1, Number(event.target.value)),
									),
								)
							}
						/>
					</label>
					<Button onClick={generate} loading={createCode.isPending}>
						{t("generate")}
					</Button>
				</div>
				<div className="divide-y rounded-md border">
					{isLoading ? (
						<p className="p-4 text-center text-sm">
							{t("loading")}
						</p>
					) : data?.joinCodes.length ? (
						data.joinCodes.map((item) => {
							const expired =
								new Date(item.expiresAt).getTime() <=
								Date.now();
							const status = item.revoked
								? "revoked"
								: expired
									? "expired"
									: "active";
							return (
								<div
									key={item.id}
									className="flex flex-wrap items-center gap-3 p-3"
								>
									<code className="font-semibold tracking-wider">
										{item.code}
									</code>
									<Badge
										status={
											status === "active"
												? "success"
												: status === "expired"
													? "warning"
													: "error"
										}
									>
										{t(`status.${status}`)}
									</Badge>
									<span className="text-foreground/60 text-xs">
										{t("expires", {
											date: new Date(
												item.expiresAt,
											).toLocaleString(),
										})}{" "}
										·{" "}
										{t("uses", { count: item.usageCount })}
									</span>
									<div className="ml-auto flex gap-1">
										<Button
											size="icon"
											variant="ghost"
											onClick={() => copy(item.code)}
											title={t("copy")}
										>
											<CopyIcon className="size-4" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											disabled={
												expired || updateCode.isPending
											}
											onClick={async () => {
												await updateCode.mutateAsync({
													id: item.id,
													revoked: !item.revoked,
												});
												await refresh();
											}}
											title={t(
												item.revoked
													? "enable"
													: "revoke",
											)}
										>
											<PowerIcon className="size-4" />
										</Button>
									</div>
								</div>
							);
						})
					) : (
						<p className="p-4 text-center text-foreground/60 text-sm">
							{t("empty")}
						</p>
					)}
				</div>
			</div>
		</SettingsItem>
	);
}

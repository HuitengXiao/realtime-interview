"use client";

import {
	adminInvitationCodesQueryKey,
	useAdminInvitationCodesQuery,
	useCreateAdminInvitationCodeMutation,
	useUpdateAdminInvitationCodeMutation,
} from "@saas/admin/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { Input } from "@ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { CheckIcon, CopyIcon, KeyRoundIcon, PowerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export function InvitationCodeList() {
	const t = useTranslations("admin.invitationCodes");
	const queryClient = useQueryClient();
	const { data, isLoading } = useAdminInvitationCodesQuery();
	const createCode = useCreateAdminInvitationCodeMutation();
	const updateCode = useUpdateAdminInvitationCodeMutation();
	const [validityDays, setValidityDays] = useState(7);
	const [copiedCode, setCopiedCode] = useState<string>();

	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: adminInvitationCodesQueryKey,
		});

	const copyCode = async (code: string) => {
		await navigator.clipboard.writeText(code);
		setCopiedCode(code);
		toast.success(t("notifications.copied"));
		window.setTimeout(() => setCopiedCode(undefined), 1500);
	};

	const handleCreate = async () => {
		try {
			const result = await createCode.mutateAsync(validityDays * 24);
			await refresh();
			await copyCode(result.invitationCode.code);
			toast.success(t("notifications.created"));
		} catch {
			toast.error(t("notifications.createError"));
		}
	};

	const setRevoked = async (id: string, revoked: boolean) => {
		try {
			await updateCode.mutateAsync({ id, revoked });
			await refresh();
			toast.success(
				t(revoked ? "notifications.revoked" : "notifications.enabled"),
			);
		} catch {
			toast.error(t("notifications.updateError"));
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<Card className="border shadow-none">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<KeyRoundIcon className="size-5" />
						{t("generate.title")}
					</CardTitle>
					<CardDescription>
						{t("generate.description")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex max-w-lg items-end gap-3">
						<label htmlFor="invitation-validity-days" className="flex-1 text-sm">
							<span className="mb-2 block font-medium">
								{t("generate.validityDays")}
							</span>
							<Input
								id="invitation-validity-days"
								type="number"
								min={1}
								max={365}
								value={validityDays}
								onChange={(event) =>
									setValidityDays(
										Math.min(
											365,
											Math.max(
												1,
												Number(event.target.value),
											),
										),
									)
								}
							/>
						</label>
						<Button
							onClick={handleCreate}
							loading={createCode.isPending}
							disabled={!Number.isFinite(validityDays)}
						>
							{t("generate.submit")}
						</Button>
					</div>
				</CardContent>
			</Card>

			<div>
				<h2 className="mb-1 font-semibold text-xl">
					{t("list.title")}
				</h2>
				<p className="mb-4 text-foreground/60 text-sm">
					{t("list.description")}
				</p>
				<div className="overflow-hidden rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("list.code")}</TableHead>
								<TableHead>{t("list.status")}</TableHead>
								<TableHead>{t("list.expiresAt")}</TableHead>
								<TableHead>{t("list.usageCount")}</TableHead>
								<TableHead className="text-right">
									{t("list.actions")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 text-center"
									>
										{t("list.loading")}
									</TableCell>
								</TableRow>
							) : data?.invitationCodes.length ? (
								data.invitationCodes.map((item) => {
									const expired =
										new Date(item.expiresAt).getTime() <=
										Date.now();
									const status = item.revoked
										? "revoked"
										: expired
											? "expired"
											: "active";
									return (
										<TableRow key={item.id}>
											<TableCell>
												<code className="font-semibold tracking-wider">
													{item.code}
												</code>
											</TableCell>
											<TableCell>
												<Badge
													status={
														status === "active"
															? "success"
															: status ===
																	"expired"
																? "warning"
																: "error"
													}
												>
													{t(`status.${status}`)}
												</Badge>
											</TableCell>
											<TableCell>
												{new Intl.DateTimeFormat(
													undefined,
													{
														dateStyle: "medium",
														timeStyle: "short",
													},
												).format(
													new Date(item.expiresAt),
												)}
											</TableCell>
											<TableCell>
												{item.usageCount}
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-2">
													<Button
														size="icon"
														variant="ghost"
														title={t(
															"actions.copy",
														)}
														onClick={() =>
															copyCode(item.code)
														}
													>
														{copiedCode ===
														item.code ? (
															<CheckIcon className="size-4" />
														) : (
															<CopyIcon className="size-4" />
														)}
													</Button>
													<Button
														size="icon"
														variant="ghost"
														title={t(
															item.revoked
																? "actions.enable"
																: "actions.revoke",
														)}
														disabled={
															expired ||
															updateCode.isPending
														}
														onClick={() =>
															setRevoked(
																item.id,
																!item.revoked,
															)
														}
													>
														<PowerIcon className="size-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})
							) : (
								<TableRow>
									<TableCell
										colSpan={5}
										className="h-24 text-center"
									>
										{t("list.empty")}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}

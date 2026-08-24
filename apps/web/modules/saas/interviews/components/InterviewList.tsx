"use client";

import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import {
	ArrowUpRightIcon,
	CalendarDaysIcon,
	CheckIcon,
	LoaderCircleIcon,
	PencilIcon,
	PlusIcon,
	RadioIcon,
	Trash2Icon,
	UserRoundIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Interview = {
	id: string;
	title: string;
	intervieweeName?: string | null;
	createdAt?: string;
	status?: string;
	createdBy?: {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
	} | null;
	isOwner?: boolean;
	canManage?: boolean;
};

export function InterviewList({
	organizationId,
	organizationSlug,
}: {
	organizationId: string;
	organizationSlug: string;
}) {
	const router = useRouter();
	const [interviews, setInterviews] = useState<Interview[]>([]);
	const [title, setTitle] = useState("");
	const [intervieweeName, setIntervieweeName] = useState("");
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editIntervieweeName, setEditIntervieweeName] = useState("");
	const [updating, setUpdating] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [ownerFilter, setOwnerFilter] = useState("all");

	const owners = useMemo(() => {
		const uniqueOwners = new Map<
			string,
			NonNullable<Interview["createdBy"]>
		>();
		for (const interview of interviews) {
			if (interview.createdBy) {
				uniqueOwners.set(interview.createdBy.id, interview.createdBy);
			}
		}
		return Array.from(uniqueOwners.values());
	}, [interviews]);

	const filteredInterviews = useMemo(() => {
		if (ownerFilter === "all") {
			return interviews;
		}
		if (ownerFilter === "mine") {
			return interviews.filter((interview) => interview.isOwner);
		}
		return interviews.filter(
			(interview) => interview.createdBy?.id === ownerFilter,
		);
	}, [interviews, ownerFilter]);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(
				`/api/interviews?organizationId=${encodeURIComponent(organizationId)}`,
				{ credentials: "include" },
			);
			if (!response.ok) {
				throw new Error("无法加载访谈列表");
			}
			const data = await response.json();
			setInterviews(Array.isArray(data) ? data : (data.interviews ?? []));
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "无法加载访谈列表",
			);
		} finally {
			setLoading(false);
		}
	}, [organizationId]);

	useEffect(() => {
		void load();
	}, [load]);

	const createInterview = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!title.trim()) {
			return;
		}
		setCreating(true);
		setError(null);
		try {
			const response = await fetch("/api/interviews", {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					organizationId,
					title: title.trim(),
					intervieweeName: intervieweeName.trim() || undefined,
				}),
			});
			if (!response.ok) {
				throw new Error("创建访谈失败");
			}
			const interview = await response.json();
			setInterviews((current) => [interview, ...current]);
			setTitle("");
			setIntervieweeName("");
			router.push(`/app/${organizationSlug}/interviews/${interview.id}`);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "创建访谈失败");
		} finally {
			setCreating(false);
		}
	};

	const deleteInterview = async (interview: Interview) => {
		if (
			!window.confirm(
				`确定删除访谈房间「${interview.title}」吗？此操作无法撤销。`,
			)
		) {
			return;
		}

		setDeletingId(interview.id);
		setError(null);
		try {
			const response = await fetch(`/api/interviews/${interview.id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("只有房主可以删除访谈房间");
			}
			setInterviews((current) =>
				current.filter((item) => item.id !== interview.id),
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "删除访谈房间失败",
			);
		} finally {
			setDeletingId(null);
		}
	};

	const beginEdit = (interview: Interview) => {
		setEditingId(interview.id);
		setEditTitle(interview.title);
		setEditIntervieweeName(interview.intervieweeName ?? "");
		setError(null);
	};

	const updateInterview = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!editingId || !editTitle.trim()) {
			return;
		}
		setUpdating(true);
		setError(null);
		try {
			const response = await fetch(`/api/interviews/${editingId}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: editTitle.trim(),
					intervieweeName: editIntervieweeName.trim() || null,
				}),
			});
			if (!response.ok) {
				throw new Error(
					response.status === 403
						? "只有房间创建者或组织管理员可以编辑"
						: "更新访谈失败",
				);
			}
			const updated = await response.json();
			setInterviews((current) =>
				current.map((item) =>
					item.id === editingId ? { ...item, ...updated } : item,
				),
			);
			setEditingId(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "更新访谈失败");
		} finally {
			setUpdating(false);
		}
	};

	return (
		<div className="space-y-7">
			<form
				onSubmit={createInterview}
				className="rounded-2xl border bg-card p-5 shadow-sm"
			>
				<div className="mb-4 flex items-center gap-2 font-semibold">
					<PlusIcon className="size-4" /> 新建访谈
				</div>
				<div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
					<Input
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="访谈主题，例如：新用户入门体验"
						required
					/>
					<Input
						value={intervieweeName}
						onChange={(event) =>
							setIntervieweeName(event.target.value)
						}
						placeholder="受访者姓名（可选）"
					/>
					<Button
						type="submit"
						loading={creating}
						className="bg-primary text-primary-foreground"
					>
						创建并进入
					</Button>
				</div>
			</form>

			{error && (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			)}
			{loading ? (
				<div className="flex items-center gap-2 py-10 text-sm opacity-60">
					<LoaderCircleIcon className="size-4 animate-spin" />
					正在加载访谈…
				</div>
			) : interviews.length === 0 ? (
				<div className="rounded-xl border border-dashed p-10 text-center text-sm opacity-60">
					还没有访谈。创建一个房间后即可开始实时记录。
				</div>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-2">
						{[
							{ id: "all", label: "全部房主" },
							{ id: "mine", label: "我的房间" },
							...owners.map((owner) => ({
								id: owner.id,
								label:
									owner.name || owner.email || "未命名房主",
							})),
						].map((filter) => (
							<button
								key={filter.id}
								type="button"
								onClick={() => setOwnerFilter(filter.id)}
								className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
									ownerFilter === filter.id
										? "border-primary bg-primary text-primary-foreground"
										: "bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
								}`}
							>
								{filter.label}
							</button>
						))}
					</div>
					{filteredInterviews.length === 0 ? (
						<div className="rounded-xl border border-dashed p-10 text-center text-sm opacity-60">
							该房主暂时没有访谈房间。
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
							{filteredInterviews.map((interview) => (
								<article
									key={interview.id}
									className="group relative flex min-h-48 flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
								>
									{editingId === interview.id ? (
										<form
											onSubmit={updateInterview}
											className="flex h-full flex-1 flex-col gap-3"
										>
											<div className="flex items-center gap-2 font-semibold text-sm text-primary">
												<PencilIcon className="size-4" />{" "}
												编辑访谈
											</div>
											<Input
												value={editTitle}
												onChange={(event) =>
													setEditTitle(
														event.target.value,
													)
												}
												placeholder="访谈主题"
												autoFocus
												required
											/>
											<Input
												value={editIntervieweeName}
												onChange={(event) =>
													setEditIntervieweeName(
														event.target.value,
													)
												}
												placeholder="受访者姓名（可选）"
											/>
											<div className="mt-auto flex justify-end gap-2">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														setEditingId(null)
													}
													disabled={updating}
												>
													<XIcon className="size-4" />{" "}
													取消
												</Button>
												<Button
													type="submit"
													size="sm"
													loading={updating}
												>
													<CheckIcon className="size-4" />{" "}
													保存
												</Button>
											</div>
										</form>
									) : (
										<>
											<div className="flex items-start justify-between gap-3">
												<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
													<RadioIcon className="size-5" />
												</div>
												{interview.canManage && (
													<div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
														<button
															type="button"
															onClick={() =>
																beginEdit(
																	interview,
																)
															}
															className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
															title="编辑访谈"
														>
															<PencilIcon className="size-4" />
														</button>
														<button
															type="button"
															onClick={() =>
																void deleteInterview(
																	interview,
																)
															}
															disabled={
																deletingId ===
																interview.id
															}
															className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
															title="删除访谈房间"
														>
															{deletingId ===
															interview.id ? (
																<LoaderCircleIcon className="size-4 animate-spin" />
															) : (
																<Trash2Icon className="size-4" />
															)}
														</button>
													</div>
												)}
											</div>
											<h3 className="mt-4 line-clamp-2 font-semibold text-lg leading-6">
												{interview.title}
											</h3>
											<div className="mt-3 space-y-1.5 text-muted-foreground text-xs">
												<p className="flex items-center gap-2">
													<UserRoundIcon className="size-3.5" />
													{interview.intervieweeName ||
														"未填写受访者"}
												</p>
												{interview.createdBy && (
													<p className="flex items-center gap-2">
														<UserRoundIcon className="size-3.5" />
														房主：
														{interview.createdBy
															.name ||
															interview.createdBy
																.email ||
															"未命名房主"}
													</p>
												)}
												{interview.createdAt && (
													<p className="flex items-center gap-2">
														<CalendarDaysIcon className="size-3.5" />
														{new Date(
															interview.createdAt,
														).toLocaleString()}
													</p>
												)}
											</div>
											<div className="mt-auto flex items-center justify-between border-t pt-4">
												<span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
													{interview.status ===
													"completed"
														? "已完成"
														: interview.status ===
																"archived"
															? "已归档"
															: "访谈房间"}
												</span>
												<Link
													href={`/app/${organizationSlug}/interviews/${interview.id}`}
													className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
												>
													进入访谈{" "}
													<ArrowUpRightIcon className="size-4" />
												</Link>
											</div>
										</>
									)}
								</article>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}

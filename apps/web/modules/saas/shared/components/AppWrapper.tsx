"use client";

import { config } from "@repo/config";
import { NavBar } from "@saas/shared/components/NavBar";
import { sidebarExpanded } from "@saas/shared/lib/state";
import { cn } from "@ui/lib";
import { useAtom } from "jotai";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import type { PropsWithChildren } from "react";

export function AppWrapper({ children }: PropsWithChildren) {
	const [isSidebarExpanded, setIsSidebarExpanded] = useAtom(sidebarExpanded);
	const useSidebarLayout = config.ui.saas.useSidebarLayout;

	return (
		<div
			className={cn(
				"bg-[radial-gradient(farthest-corner_at_0%_0%,color-mix(in_oklch,var(--color-primary),transparent_95%)_0%,var(--color-background)_50%)] dark:bg-[radial-gradient(farthest-corner_at_0%_0%,color-mix(in_oklch,var(--color-primary),transparent_90%)_0%,var(--color-background)_50%)]",
				[config.ui.saas.useSidebarLayout ? "" : ""],
			)}
		>
			<NavBar expanded={isSidebarExpanded} />
			{useSidebarLayout && (
				<button
					type="button"
					onClick={() =>
						setIsSidebarExpanded((expanded) => !expanded)
					}
					className={cn(
						"fixed top-4 z-50 hidden size-10 items-center justify-center rounded-lg border bg-background text-foreground shadow-sm transition-[left,background-color] duration-200 hover:bg-muted md:inline-flex",
						isSidebarExpanded ? "left-[224px]" : "left-4",
					)}
					aria-label={isSidebarExpanded ? "隐藏侧边栏" : "显示侧边栏"}
					aria-controls="app-sidebar"
					aria-expanded={isSidebarExpanded}
					title={isSidebarExpanded ? "隐藏侧边栏" : "显示侧边栏"}
				>
					{isSidebarExpanded ? (
						<PanelLeftCloseIcon className="size-5" />
					) : (
						<PanelLeftOpenIcon className="size-5" />
					)}
				</button>
			)}
			<div
				className={cn("px-0 md:transition-[margin] md:duration-200", {
					"min-h-[calc(100vh-1rem)]": useSidebarLayout,
					"md:ml-[280px]": useSidebarLayout && isSidebarExpanded,
				})}
			>
				<main
					className={cn("container max-w-6xl py-6", [
						config.ui.saas.useSidebarLayout ? "" : "",
					])}
				>
					{children}
				</main>
			</div>
		</div>
	);
}

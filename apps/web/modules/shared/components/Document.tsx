import { AnalyticsScript } from "@analytics";
import { config } from "@repo/config";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { Toaster } from "@ui/components/toast";
import { cn } from "@ui/lib";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";
// import { Poppins } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

// 临时使用系统字体避免网络连接问题
// const sansFont = Poppins({
// 	subsets: ["latin"],
// 	weight: ["400", "500", "600", "700"],
// 	variable: "--font-sans",
// 	fallback: ["system-ui", "sans-serif"],
// 	display: "swap",
// });

const sansFont = {
	variable: "--font-sans",
};

export function Document({
	children,
	locale,
}: PropsWithChildren<{ locale: string }>) {
	return (
		<html lang={locale} suppressHydrationWarning>
			<body
				className={cn(
					"min-h-screen bg-background font-sans text-foreground antialiased",
					sansFont.variable,
				)}
			>
				<NuqsAdapter>
					<NextTopLoader color="var(--color-primary)" />
					<ThemeProvider
						attribute="class"
						disableTransitionOnChange
						enableSystem
						defaultTheme={config.ui.defaultTheme}
						themes={config.ui.enabledThemes}
					>
						<ApiClientProvider>
							<JotaiProvider>{children}</JotaiProvider>
						</ApiClientProvider>
					</ThemeProvider>
					<Toaster position="top-right" />
					<AnalyticsScript />
				</NuqsAdapter>
			</body>
		</html>
	);
}

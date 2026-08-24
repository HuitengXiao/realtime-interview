
import { Button } from "@ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

export function Hero() {
	return (
		<div className="relative max-w-full overflow-x-hidden bg-linear-to-b from-0% from-card to-[45vh] to-background">
			<div className="absolute left-1/2 z-10 ml-[-500px] h-[500px] w-[1000px] rounded-full bg-linear-to-r from-primary to-background opacity-30 blur-[150px]" />
			<div className="container relative z-20 pt-44 pb-12 text-center lg:pb-16">
				{/* <div className="mb-4 flex justify-center">
					<div className="mx-auto flex flex-wrap items-center justify-center rounded-full border border-highlight/50 bg-card/80 p-px px-4 py-1 font-normal text-highlight text-sm shadow-sm">
						<span className="flex items-center gap-2 rounded-full font-semibold text-highlight">
							<span className="size-2 rounded-full bg-highlight" />
							Slogan:
						</span>
						<span className="ml-1 block font-medium text-foreground/80">
							Realtime Interview: Master Your Adventure.
						</span>
					</div>
				</div> */}

				<h1 className="mx-auto max-w-3xl text-balance font-bold text-5xl lg:text-7xl">
					Realtime Interview
				</h1>

				<h1 className="mx-auto max-w-2xl text-balance font-bold text-3xl lg:text-5xl mt-2">
					最好用的实时访谈系统。

				</h1>

				<p className="mx-auto mt-4 max-w-lg text-balance text-foreground/80 text-lg">
					团队高效管理的实时访谈系统。
				</p>


				<div className="mt-6 flex flex-col items-center justify-center gap-3 md:flex-row">
					<Button size="lg" variant="primary" asChild>
						<Link href="/app">
							立即开始
							<ArrowRightIcon className="ml-2 size-4" />
						</Link>
					</Button>

				</div>




				<div className="mt-16 px-8 text-center">
					<h5 className="font-semibold text-foreground/70 text-xs uppercase tracking-wider">
						Co-creator & Co-builder & Founding Partner
					</h5>

					<div className="mt-4 flex flex-col-reverse items-center justify-center gap-4 text-foreground/70 md:flex-row md:gap-8">



					</div>
				</div>
			</div>
		</div>
	);
}

import type { PropsWithChildren } from "react";

interface SectionProps extends PropsWithChildren {
	title: string;
	subtitle: string;
}

export function Section({ children, title, subtitle }: SectionProps) {
	return (
		<section className="container py-24">
			<div className="mx-auto max-w-2xl text-center">
				<p className="font-mono text-sm uppercase tracking-widest text-primary">
					{subtitle}
				</p>
				<h2 className="mt-2 font-bold text-3xl leading-tight tracking-tighter md:text-4xl lg:text-5xl lg:leading-tight">
					{title}
				</h2>
			</div>
			{children}
		</section>
	);
}
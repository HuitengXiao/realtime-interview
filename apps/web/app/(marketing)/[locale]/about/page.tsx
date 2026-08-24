
import { Newsletter } from "@marketing/home/components/Newsletter";

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="relative py-24 text-center">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
				<div className="container relative">
					<h1 className="mb-6 font-bold text-4xl lg:text-6xl text-foreground">
						About us
					</h1>
					<p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
						To be continue。
					</p>
				</div>
			</section>

			<Newsletter />

		</div>
	);
}
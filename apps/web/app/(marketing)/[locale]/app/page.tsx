import { Button } from "@ui/components/button";
import {
	TargetIcon,
	MicIcon,
	ClockIcon,
	ImageIcon,
} from "lucide-react";
import Link from "next/link";

const features = [
	{
		id: 1,
		icon: TargetIcon,
		title: "详细传记",
		description: "深入了解成长历程、创业或事业历程和人生轨迹，全面展现他们的人生轨迹。"
	},
	{
		id: 2,
		icon: MicIcon,
		title: "有声传记",
		description: "同步有声书，让您在任何场合轻松聆听他们的故事。"
	},
	{
		id: 3,
		icon: ClockIcon,
		title: "事件轴展示",
		description: "事件轴设计，直观展现每位不凡之人的重要人生节点和成就里程碑。"
	},
	{
		id: 4,
		icon: ImageIcon,
		title: "丰富图库",
		description: "精心收集的历史图片和珍贵瞬间，让您更直观地感受世界名人的真实面貌。"
	},

];

function FeatureCard({ feature }: { feature: typeof features[0] }) {
	const Icon = feature.icon;

	return (
		<div className="group relative overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
			<div className="flex flex-col items-center text-center">
				<div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
					<Icon className="size-8 text-primary" />
				</div>
				<h3 className="mb-3 font-bold text-lg text-foreground">
					{feature.title}
				</h3>
				<p className="text-sm text-muted-foreground leading-relaxed">
					{feature.description}
				</p>
			</div>
		</div>
	);
}

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="relative py-24 text-center">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
				<div className="container relative">
					<h1 className="mb-6 font-bold text-4xl lg:text-6xl text-foreground">
						关于我们
					</h1>
					<p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
						探索改变世界的平凡人的非凡故事，了解他们的成长历程、创新思维和卓越成就。
					</p>
				</div>
			</section>

			{/* Mission Section */}
			<section className="py-16">
				<div className="container">
					<div className="mx-auto max-w-4xl text-center">
						<div className="mb-8 flex justify-center">
							<div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
								<TargetIcon className="size-10 text-primary" />
							</div>
						</div>

						<h2 className="mb-8 font-bold text-3xl lg:text-4xl text-foreground">
							我们的使命
						</h2>

						<div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
							<p>
								我们致力于记录和分享平凡与不凡故事，通过文字传记、有声讲述和丰富的视觉内容，让更多人了解这些平凡的伟大人物，从中获得启发和动力。
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-16 bg-muted/20">
				<div className="container">
					<div className="mb-16 text-center">
						<h2 className="mb-6 font-bold text-3xl lg:text-4xl text-foreground">
							平台特色
						</h2>
						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							我们通过多种形式和功能，为您提供最丰富、最深入的传奇人物故事体验
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
						{features.map((feature) => (
							<FeatureCard key={feature.id} feature={feature} />
						))}
					</div>
				</div>
			</section>

			{/* Values Section */}
			<section className="py-16">
				<div className="container">
					<div className="mx-auto max-w-4xl">
						<h2 className="mb-12 text-center font-bold text-3xl lg:text-4xl text-foreground">
							我们的价值观
						</h2>

						<div className="grid gap-8 md:grid-cols-3">
							<div className="text-center">
								<div className="mb-4 flex justify-center">
									<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
										<span className="font-bold text-2xl text-primary">真</span>
									</div>
								</div>
								<h3 className="mb-3 font-bold text-lg text-foreground">
									真实性
								</h3>
								<p className="text-sm text-muted-foreground">
									我们致力于提供真实、准确的人物传记，每个故事都经过严格的事实核查。
								</p>
							</div>

							<div className="text-center">
								<div className="mb-4 flex justify-center">
									<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
										<span className="font-bold text-2xl text-primary">深</span>
									</div>
								</div>
								<h3 className="mb-3 font-bold text-lg text-foreground">
									深度性
								</h3>
								<p className="text-sm text-muted-foreground">
									不仅仅是表面的成功故事，我们深入挖掘人物的成长背景和内心世界。
								</p>
							</div>

							<div className="text-center">
								<div className="mb-4 flex justify-center">
									<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
										<span className="font-bold text-2xl text-primary">启</span>
									</div>
								</div>
								<h3 className="mb-3 font-bold text-lg text-foreground">
									启发性
								</h3>
								<p className="text-sm text-muted-foreground">
									通过这些传奇故事，激发读者的创新思维和奋斗精神。
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-16 bg-gradient-to-r from-primary/10 to-accent/10">
				<div className="container text-center">
					<h2 className="mb-6 font-bold text-3xl lg:text-4xl text-foreground">
						开始您的探索之旅
					</h2>
					<p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
						立即开始探索这些平凡人的非凡故事，从他们的经历中获得智慧和灵感
					</p>
					<div className="mt-12 flex flex-col items-center gap-4 sm:flex-row justify-center">
						<Link href="/contact">
							<Button size="lg" variant="primary">
								联系我们
							</Button>
						</Link>
						<Link href="/">
							<Button size="lg" variant="outline">
								返回首页
							</Button>
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
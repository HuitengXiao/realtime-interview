import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();
	return {
		title: "联系我们",
	};
}

export default async function ContactPage() {
	return (
		<div className="container max-w-2xl pt-32 pb-16">
			<div className="mb-12 pt-8 text-center">
				<h1 className="mb-2 font-bold text-5xl text-foreground">
					联系我们
				</h1>
				<p className="text-balance text-lg text-muted-foreground">
					通过项目公开渠道与我们联系
				</p>
			</div>

			<div className="text-center space-y-8">
				<div className="max-w-lg mx-auto space-y-4">
					<h2 className="text-xl font-semibold text-foreground">
						联系方式
					</h2>
					<p className="text-muted-foreground leading-relaxed">
						请通过项目主页或代码仓库中公布的渠道联系我们。我们期待与你交流与合作。
					</p>
				</div>
			</div>
		</div>
	);
}

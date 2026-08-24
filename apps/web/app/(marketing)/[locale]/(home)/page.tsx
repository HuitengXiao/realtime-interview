
import { Hero } from "@marketing/home/components/Hero";
import { Newsletter } from "@marketing/home/components/Newsletter";
import { setRequestLocale } from "next-intl/server";
import { FaqSection } from "@marketing/home/components/FaqSection";
export default async function Home({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
			<Hero />
			{/* <Features /> */}
			{/* <Testimonials /> */}

			<FaqSection />
			<Newsletter />
		</>
	);
}

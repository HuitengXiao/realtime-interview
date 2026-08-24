
import {
	PaperclipIcon,
	StarIcon,
	WandIcon,
	ShareIcon,
	BatteryFull,
	Mic,
	Palette,
	Podcast,
	Rewind,
	Shield,
	Waves,
	Camera,
} from "lucide-react";
import type { StaticImageData } from "next/image";
import type { JSXElementConstructor, ReactNode } from "react";

export const featureTabs: Array<{
	id: string;
	title: string;
	icon: JSXElementConstructor<any>;
	subtitle?: string;
	description?: ReactNode;
	image?: StaticImageData;
	imageBorder?: boolean;
	stack?: {
		title: string;
		href: string;
		icon: JSXElementConstructor<any>;
	}[];
	highlights?: {
		title: string;
		description: string;
		icon: JSXElementConstructor<any>;
		demoLink?: string;
		docsLink?: string;
	}[];
}> = [
	{
		id: "ai-power",
		title: "AI Power",
		icon: WandIcon,
		subtitle: "Zero Hassle.",
		description:
			"From effortless pairing to crystal-clear audio, we've harnessed AI to eliminate the friction, so you can focus on the adventure.",
		highlights: [
			{
				title: "Tap, Sync, Talk.",
				description:
					"Forget manuals and complicated pairing. Our AI-assisted onboarding gets your crew connected in seconds. Just tap devices together and start the conversation.",
				icon: Podcast,
			},
			{
				title: "AI-Powered Clarity",
				description:
					"Our intelligent noise-cancelling algorithm slashes through wind, speed, and background chatter. Hear every word, every laugh, crystal clear, no matter the conditions.",
				icon: Waves,
			},
			{
				title: "Hands-Free VOX Mode",
				description:
					"Keep your hands on the handlebars or ski poles. Smart voice activation lets you talk freely without ever pressing a button. Just speak, and be heard.",
				icon: Mic,
			},
		],
	},
	{
		id: "your-style",
		title: "Your Style",
		icon: StarIcon,
		subtitle: "Your Rules.",
		description:
			"Realtime Interview is built to adapt to you. Customize its look, feel, and function to match your gear and your style. It's your device, your adventure.",
		highlights: [
			{
				title: "Designed for You. Defined by You.",
				description:
					"From custom LED colors to a programmable 'Roger' button and hands-free PTT modes, you control how Realtime Interview looks, feels, and functions. It’s your device, your rules.",
				icon: Palette,
			},
			{
				title: "All-Day Epic Battery",
				description:
					"From the first lift to the last run, our extended battery life keeps you connected. With up to 24 hours of talk time and 96 hours of standby, the adventure doesn't stop—and neither do we.",
				icon: BatteryFull,
			},
			{
				title: "Secure It Anywhere",
				description:
					"With our secure quick-release clip and powerful magnetic mount, Realtime Interview attaches to your jacket, pack, or bike in a snap. It stays put, no matter the terrain.",
				icon: PaperclipIcon,
			},
		],
	},
	{
		id: "more-than-talk",
		title: "More Than Talk",
		icon: ShareIcon,
		subtitle: "Your Adventure, Reimagined.",
		description:
			"Realtime Interview is more than a communication device. It's a tool to enhance your safety, capture key moments, and turn your experiences into shareable stories.",
		highlights: [
			{
				title: "Smart Safety Zone",
				description:
					"Set a virtual perimeter for your crew with Geo-fence. Get instant alerts if anyone strays too far or falls behind. It’s not just tracking; it’s peace of mind.",
				icon: Shield,
			},
			{
				title: "Instant Replay",
				description:
					"Missed something important? A single tap lets you replay the last transmission. Never ask 'Can you repeat that?' again.",
				icon: Rewind,
			},
			{
				title: "Your Adventure, Reimagined.",
				description:
					"The conversation doesn't end on the slopes. Our companion app lets you manage groups, relive your day with visualized stats, and auto-generate stunning posters of your adventure to share with the world.",
				icon: Camera,
			},
		],
	},
];

export function Features() {
	return (
		<section id="features" className="scroll-my-20 py-24 sm:py-32">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">

			</div>
		</section>
	);
}

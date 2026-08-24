import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { SearchIcon, } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

// 模拟人物数据
const legends = [
	{
		id: 1,
		name: "孙刚",
		role: "民营企业家",
		category: "企业家",
		description: '打造了"梅园餐厅"、"月潭酒家"、"三鸣大厦"、"三鸣页岩"、"8号公馆"等在长春具有时代印记的商业项目',
		image: "/images/sungang.jpg",
		tags: ["餐饮", "建筑", "高端服务业", "企业家"],
		achievements: ["梅园餐厅","月潭酒家","三鸣大厦","三鸣页岩","8号公馆"],
		nationality: "中国"
	},

];

const categories = ["全部", "科技", "企业家", "文学", "科学"];

function PersonCard({ person }: { person: typeof legends[0] }) {
	return (
		<Link href={`/famous/${person.id}`} className="block">
			<div className="group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 cursor-pointer">
				<div className="relative h-48 overflow-hidden">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
					<Image
						src={person.image}
						alt={person.name}
						fill
						className="object-cover"
					/>
					<div className="absolute left-3 top-3">
						<span className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
							{person.category}
						</span>
					</div>
					<div className="absolute right-3 top-3">
						<span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
							{person.nationality}
						</span>
					</div>
				</div>
				<div className="p-4">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{person.name}</h3>
					</div>
					<p className="mb-2 text-sm font-medium text-primary">{person.role}</p>
					<p className="mb-3 text-sm text-muted-foreground line-clamp-2">
						{person.description}
					</p>

					{/* 主要成就 */}
					<div className="mb-3">
						<p className="mb-1 text-xs font-medium text-foreground">主要成就:</p>
						<div className="flex flex-wrap gap-1">
							{person.achievements.slice(0, 2).map((achievement, index) => (
								<span
									key={index}
									className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary border border-primary/20"
								>
									{achievement}
								</span>
							))}
							{person.achievements.length > 2 && (
								<span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
									+{person.achievements.length - 2}
								</span>
							)}
						</div>
					</div>

					{/* 标签 */}
					<div className="flex flex-wrap gap-1">
						{person.tags.map((tag, index) => (
							<span
								key={index}
								className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
			</div>
		</Link>
	);
}

export default function LegendsPage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="relative py-10 text-center">

			</section>

			{/* Search and Filter Section */}
			<section className="py-8">
				<div className="container">
					<div className="mx-auto max-w-4xl">
						<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center">
							<div className="relative flex-1">
								<SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="搜索名人或关键词..."
									className="pl-10"
								/>
							</div>

						</div>

						{/* Category Tabs */}
						{/* <div className="mb-8 flex flex-wrap gap-2">
							{categories.map((category, index) => (
								<Button
									key={category}
									variant={index === 0 ? "primary" : "outline"}
									size="sm"
									className="rounded-full"
								>
									{category}
								</Button>
							))}
						</div>*/}
					</div>
				</div>
			</section>

			{/* Legends Grid */}
			<section className="pb-24">
				<div className="container">
					<Suspense fallback={<div>Loading...</div>}>
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{legends.map((person) => (
								<PersonCard key={person.id} person={person} />
							))}
						</div>
					</Suspense>

					{/* Load More */}
					<div className="mt-12 text-center">
						<Button variant="outline" size="lg">
							未完待续
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
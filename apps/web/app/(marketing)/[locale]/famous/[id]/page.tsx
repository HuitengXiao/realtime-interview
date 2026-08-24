
import { Button } from "@ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@ui/components/dialog"; // 导入Dialog组件, 移除DialogClose
import { ArrowLeftIcon, CalendarIcon, AwardIcon, BookOpenIcon, HeadphonesIcon, } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

// 模拟详细人物数据
const detailedLegends = {
	"1": {
		id: 1,
		name: "孙刚",
		fullName: "孙刚",
		role: "民营企业家",
		category: "企业家",
		description: '打造了包括著名的 "梅园餐厅"、"月潭酒家"、"三鸣大厦"、"三鸣页岩"、"8号公馆"等在长春具有时代印记的商业项目',
		image: "/images/sungang.jpg",
		tags: ["餐饮", "建筑", "高端服务业", "企业家"],
		achievements: ["梅园餐厅", "月潭酒家", "三鸣大厦", "三鸣页岩", "8号公馆"],
		birthYear: "1955",
		birthDate: "1955年10月",
		birthPlace: "中国吉林省长春市",
		nationality: "中国",
		education: "长春职工大学（夜大）机械制造专业",
		netWorth: "数千万人民币",
		fullBio: `孙刚先生是在吉林省长春市有着重要影响力的一位企业家。他凭借敏锐的商业嗅觉和过人的胆识与才能，在建筑、房地产、高端服务业等多个领域取得多项卓越的成就，打造了包括著名的 "梅园餐厅"、"月潭酒家"、"三鸣大厦"、"三鸣页岩"、"8号公馆"等在长春具有时代印记的商业项目。

		他凭借敏锐的洞察力和卓越的毅力在商海中开辟出一片天地，乐观的心态与独到的经营哲学，每一步都凝聚着您的智慧与汗水，富含独特的视角和睿智的决策

		孙刚先生不仅在商业上取得了卓越成就，还积极参与文艺活动，小提琴，钢琴，美声每样都不在话下，如今还担任老年合唱团团长，在维也纳金色大厅等国际舞台上展现中国企业家的风采。`,
		timeline: [
			{

				title: "下乡知青",
				description: "前往德惠县达家沟公社，成为下乡知青，在艰苦环境中磨练意志。",
				type: "career"
			},
			{

				title: "参军入伍",
				description: "正式参军，在部队担任班长和炊事班长，接受三年军旅生涯的淬炼。",
				type: "career"
			},
			{

				title: "退伍进厂",
				description: "退伍后进入东风汽车制造厂工作，同时攻读长春职工大学机械制造专业。",
				type: "transition"
			},
			{

				title: "初涉商海",
				description: "做君子兰投资，在岳阳街摆摊经营服装生意，创办三星百货商店，实现自产自销。",
				type: "career"
			},
			{

				title: "创办梅园餐厅",
				description: "创办梅园餐厅，凭借优质服务迅速成为岳阳街餐饮标杆。",
				type: "achievement"
			},
			{

				title: "国企总经理",
				description: "担任长春市农垦农工商联合公司总经理，成功扭亏为盈。",
				type: "career"
			},
			{
				title: "跨界建筑业",
				description: "承包省建总公司第三工程处，承建吉林大学第一医院综合大楼等重要工程。",
				type: "achievement"
			},
			{
				title: "月潭酒家开业",
				description: "在净月潭景区门口创办月潭酒家，成为当地高端餐饮和社交场所。",
				type: "achievement"
			},
			{
				title: "进军页岩产业",
				description: "成立三鸣页岩科技有限公司，虽遭遇重大纠纷，最终化险为夷。",
				type: "achievement"
			},
			{
				title: "8号公馆辉煌",
				description: "将三鸣大厦改造为8号公馆，打造长春顶级洗浴休闲中心。",
				type: "achievement"
			},
			{
				title: "艺术人生",
				description: "担任老年合唱团团长，在维也纳金色大厅等国际舞台展现风采。",
				type: "achievement"
			}
		],
		quotes: [
			"撞了南墙也不回头，把墙撞个窟窿也要走过去。",
			"做生意要有诚信，做人要有担当。",
			"人生就是一个永无止境的学习、探索和完善自我的漫长旅程。"
		],
		relatedPeople: [] as RelatedPerson[]
	}
};

interface PageProps {
	params: Promise<{ id: string }>;
}

interface RelatedPerson {
	id: string;
	name: string;
	role: string;
}

type TimelineItemType = "birth" | "achievement" | "career" | "transition";

function TimelineItem({ item }: { item: typeof detailedLegends["1"]["timeline"][0] }) {
	const typeStyles: Record<TimelineItemType, string> = {
		birth: "bg-green-500/10 text-green-600 border-green-500/20",
		achievement: "bg-primary/10 text-primary border-primary/20",
		career: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		transition: "bg-purple-500/10 text-purple-600 border-purple-500/20"
	};

	return (
		<div className="relative flex items-start gap-4 pb-8">
			<div className="relative flex-shrink-0">
				<div className={`flex size-10 items-center justify-center rounded-full border-2 ${typeStyles[item.type as TimelineItemType]}`}>
					<span className="size-2 rounded-full bg-current" />
				</div>
				<div className="absolute left-1/2 top-10 h-full w-0.5 bg-border -translate-x-1/2" />
			</div>
			<div className="flex-1 pt-1">
				<h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
				<p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
			</div>
		</div>
	);
}

export default async function PersonDetailPage({ params }: PageProps) {
	const { id } = await params;
	const person = detailedLegends[id as keyof typeof detailedLegends];

	if (!person) {
		notFound();
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<section className="relative py-12 bg-gradient-to-br from-primary/5 via-background to-accent/5">
				<div className="container">
					<Link
						href="/famous"
						className="mt-20 inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-200 mb-8"
					>
						<ArrowLeftIcon className="size-4" />
						返回目录
					</Link>

					<div className="flex flex-col lg:flex-row gap-8">
						{/* 人物头像区域 */}
						<div className="flex-shrink-0">
							<div className="relative">
								<div className="size-64 rounded-3xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
									<Image
										src={person.image}
										alt={person.name}
										width={256}
										height={256}
										className="object-cover w-full h-full"
										priority
										quality={85}
									/>
								</div>

							</div>
						</div>

						{/* 基本信息 */}
						<div className="flex-1">


							<h1 className="font-bold text-4xl lg:text-5xl text-foreground mb-2">
								{person.name}
							</h1>
							<p className="text-xl text-primary font-medium mb-4">{person.role}</p>
							<p className="text-lg text-muted-foreground leading-relaxed mb-6">
								{person.description}
							</p>

							{/* 基本信息网格 */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

							</div>

							{/* 操作按钮区域 */}
							<div className="mt-8 flex flex-wrap gap-4">
								<Button variant="primary" size="lg">
									<BookOpenIcon className="mr-2 size-4" />
									阅读传记
								</Button>
								<Dialog>
									<DialogTrigger asChild>
										<Button variant="outline" size="lg">
											<HeadphonesIcon className="mr-2 size-4" />
											听有声书
										</Button>
									</DialogTrigger>
									<DialogContent className="sm:max-w-[480px] bg-background border-primary/20 p-0">
										<DialogHeader className="p-6 pb-0">
											<DialogTitle className="text-foreground">有声书：《时机"刚"好》</DialogTitle>
										</DialogHeader>
										<div className="p-6 flex justify-center">
											<Image
												src="/images/时机刚好.jpg"
												alt="有声书封面：时机刚好"
												width={400}
												height={600} // 根据图片实际比例调整
												className="rounded-lg shadow-lg"
											/>
										</div>
										<DialogFooter className="p-6 pt-0">
											<DialogTrigger asChild>
												<Button variant="outline">关闭</Button>
											</DialogTrigger>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* 主要内容 */}
			<section className="py-16">
				<div className="container">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
						{/* 左侧主要内容 */}
						<div className="lg:col-span-2 space-y-12">
							{/* 简介 */}
							<div>
								<h2 className="font-bold text-2xl text-foreground mb-6 flex items-center gap-2">
									<BookOpenIcon className="size-6 text-primary" />
									简介
								</h2>
								<div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
									{person.fullBio.split('\n\n').map((paragraph, index) => (
										<p key={index} className="mb-4 last:mb-0">
											{paragraph}
										</p>
									))}
								</div>
							</div>

							{/* 大事件 */}
							<div>
								<h2 className="font-bold text-2xl text-foreground mb-6 flex items-center gap-2">
									<CalendarIcon className="size-6 text-primary" />
									大事件
								</h2>
								<div className="relative">
									{person.timeline.map((item, index) => (
										<TimelineItem key={index} item={item} />
									))}
								</div>
							</div>

							{/* 名言语录 */}
							<div>
								<h2 className="font-bold text-2xl text-foreground mb-6">名言语录</h2>
								<div className="space-y-4">
									{person.quotes.map((quote, index) => (
										<blockquote key={index} className="border-l-4 border-primary pl-6 py-2">
											<p className="text-lg text-foreground italic">"{quote}"</p>

										</blockquote>
									))}
								</div>
							</div>
						</div>

						{/* 右侧边栏 */}
						<div className="space-y-8">
							{/* 主要成就 */}
							<div className="rounded-2xl border bg-card p-6">
								<h3 className="font-bold text-lg text-foreground mb-4 flex items-center gap-2">
									<AwardIcon className="size-5 text-primary" />
									主要成就
								</h3>
								<div className="space-y-2">
									{person.achievements.map((achievement, index) => (
										<div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
											<span className="size-2 rounded-full bg-primary flex-shrink-0" />
											<span className="text-sm text-foreground">{achievement}</span>
										</div>
									))}
								</div>
							</div>

							{/* 相关人物 */}
							{person.relatedPeople.length > 0 && (
								<div className="rounded-2xl border bg-card p-6">
									<h3 className="font-bold text-lg text-foreground mb-4">相关人物</h3>
									<div className="space-y-3">
										{person.relatedPeople.map((relatedPerson) => (
											<Link
												key={relatedPerson.id}
												href={`/famous/${relatedPerson.id}`}
												className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
											>
												<div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
													<span className="text-sm font-bold text-primary">
														{relatedPerson.name.charAt(0)}
													</span>
												</div>
												<div className="flex-1">
													<p className="font-medium text-foreground group-hover:text-primary transition-colors">
														{relatedPerson.name}
													</p>
													<p className="text-xs text-muted-foreground">{relatedPerson.role}</p>
												</div>
											</Link>
										))}
									</div>
								</div>
							)}


						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

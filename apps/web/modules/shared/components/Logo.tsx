import { cn } from "@ui/lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<svg className="size-10 text-primary" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <title>Realtime Interview</title>
    <path
        opacity="0.2"
        d="M 40 2 L 74.6 21 L 74.6 59 L 40 78 L 5.4 59 L 5.4 21 Z"
        fill="currentColor"
    />
    <path
        opacity="0.4"
        d="M 40 8 L 69.3 25 L 69.3 55 L 40 72 L 10.7 55 L 10.7 25 Z"
        fill="currentColor"
    />
    <path
        d="M 25 24 H 55 V 29 H 25 Z M 25 31 H 55 V 36 H 25 Z M 20 38 H 60 V 43 H 20 Z M 24 43 V 63 H 32 V 43 Z M 48 43 V 63 H 56 V 43 Z"
        fill="currentColor"
    />
</svg>

			{withLabel && (
				<span className="ml-3 hidden text-lg md:block">Realtime Interview</span>
			)}
		</span>
	);
}

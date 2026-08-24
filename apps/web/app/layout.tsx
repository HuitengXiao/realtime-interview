import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";

	export const metadata: Metadata = {
	title: {
		absolute: "Realtime Interview",
		default: "Realtime Interview",
		template: "%s | Realtime Interview",
	},
};

export default function RootLayout({ children }: PropsWithChildren) {
	return children;
}

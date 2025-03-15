// simply-learn/client/src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
	FpjsProvider,
	FingerprintJSPro,
} from "@fingerprintjs/fingerprintjs-pro-react";
import "./globals.css";

// https://github.com/fingerprintjs/fingerprintjs-pro-react/blob/main/examples/next-appDir/app/HomePage.tsx
const fpjsPublicApiKey = process.env.NEXT_PUBLIC_FPJS_PUBLIC_API_KEY as string;

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "SimplyLearn - AI-Powered Learning Platform",
	description: "Learn anything at your own pace with SimplyLearn.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<FpjsProvider
					loadOptions={{
						apiKey: fpjsPublicApiKey,
						endpoint: FingerprintJSPro.defaultEndpoint,
						scriptUrlPattern:
							FingerprintJSPro.defaultScriptUrlPattern,
					}}
				>
					{children}
				</FpjsProvider>
			</body>
		</html>
	);
}

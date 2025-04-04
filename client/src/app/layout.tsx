// simply-learn/client/src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
	FpjsProvider,
	FingerprintJSPro,
} from "@fingerprintjs/fingerprintjs-pro-react";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/components/theme-provider";


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
				<AuthProvider>
					{/* <FpjsProvider
						loadOptions={{
							apiKey: fpjsPublicApiKey,
							endpoint: FingerprintJSPro.defaultEndpoint,
							scriptUrlPattern:
								FingerprintJSPro.defaultScriptUrlPattern,
						}}
					>
						{children}
					</FpjsProvider> */}
					<Toaster position="top-center" />
					{/* <ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						{children}
					</ThemeProvider> */}
					{children}
				</AuthProvider>
			</body>
		</html>
	);
}

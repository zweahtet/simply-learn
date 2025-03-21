// client/src/components/Welcome.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, BookOpen, Video, PenTool, ArrowRight } from "lucide-react";

interface WelcomeProps {
	onGetStarted: () => void;
	onLogin: () => void;
}

export function Welcome() {
	return (
		<div className="container mx-auto px-4 py-12 max-w-6xl">
			<div className="text-center mb-12">
				<h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
					Welcome to EquiLearn
				</h1>
				<p className="text-xl text-gray-600 max-w-3xl mx-auto">
					AI-powered educational content adaptation personalized to
					your cognitive style and language level
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-8 mb-16">
				<div className="flex flex-col justify-center">
					<h2 className="text-3xl font-bold mb-6">
						Learn at your own pace, in your own way
					</h2>
					<p className="text-gray-600 mb-6">
						EquiLearn uses advanced AI to adapt educational content
						to match both your language proficiency and your unique
						cognitive profile, making learning more accessible and
						effective.
					</p>
					<div className="flex flex-col sm:flex-row gap-4">
						<Button size="lg" asChild>
							<Link href="/assessment">
								Get Started{" "}
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button size="lg" variant="outline" asChild>
							<Link href="/login">Sign In</Link>
						</Button>
					</div>
				</div>
				<div className="bg-blue-100 rounded-xl p-8 flex items-center justify-center">
					<div className="max-w-sm">
						<img
							src="/hero-illustration.svg"
							alt="EquiLearn illustration"
							className="w-full h-auto"
							onError={(e) => {
								e.currentTarget.src =
									"https://placehold.co/600x400/e4f1fe/2563eb?text=EquiLearn";
							}}
						/>
					</div>
				</div>
			</div>

			<h2 className="text-2xl font-bold text-center mb-8">
				How it works
			</h2>

			<div className="grid md:grid-cols-4 gap-6 mb-16">
				<Card className="p-6 text-center flex flex-col items-center">
					<div className="bg-blue-100 p-4 rounded-full mb-4">
						<Brain className="h-6 w-6 text-blue-600" />
					</div>
					<h3 className="font-bold mb-2">Assessment</h3>
					<p className="text-gray-600 text-sm">
						Take a brief assessment to determine your language level
						and cognitive preferences
					</p>
				</Card>

				<Card className="p-6 text-center flex flex-col items-center">
					<div className="bg-blue-100 p-4 rounded-full mb-4">
						<BookOpen className="h-6 w-6 text-blue-600" />
					</div>
					<h3 className="font-bold mb-2">Adaptation</h3>
					<p className="text-gray-600 text-sm">
						Our AI adapts educational content to match your unique
						learning profile
					</p>
				</Card>

				<Card className="p-6 text-center flex flex-col items-center">
					<div className="bg-blue-100 p-4 rounded-full mb-4">
						<Video className="h-6 w-6 text-blue-600" />
					</div>
					<h3 className="font-bold mb-2">Video Learning</h3>
					<p className="text-gray-600 text-sm">
						Discover AI-recommended videos that reinforce concepts
						at your level
					</p>
				</Card>

				<Card className="p-6 text-center flex flex-col items-center">
					<div className="bg-blue-100 p-4 rounded-full mb-4">
						<PenTool className="h-6 w-6 text-blue-600" />
					</div>
					<h3 className="font-bold mb-2">Practice</h3>
					<p className="text-gray-600 text-sm">
						Generate custom exercises to reinforce your learning and
						track progress
					</p>
				</Card>
			</div>

			<div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-8 text-white text-center">
				<h2 className="text-2xl font-bold mb-4">
					Ready to transform your learning experience?
				</h2>
				<p className="mb-6 max-w-2xl mx-auto">
					Join thousands of students who are using EquiLearn to make
					educational content more accessible and effective for their
					unique learning style.
				</p>
				<Button
					size="lg"
					variant="secondary"
					className="bg-white text-blue-600 hover:bg-blue-50"
					asChild
				>
					<Link href="/assessment">Start Your Assessment</Link>
				</Button>
			</div>
		</div>
	);
}

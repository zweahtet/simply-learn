// src/components/AssessmentResults.tsx
"use client";

import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Check, ArrowRight, BookOpen, Users } from "lucide-react";

interface CognitiveProfile {
	memory: number;
	attention: number;
	language: number;
	visualSpatial: number;
	executive: number;
}

interface AssessmentResultsSummary {
	languageLevel: string;
	cognitiveProfile: CognitiveProfile;
	overallScore: number;
}

interface AssessmentResultsProps {
	results: AssessmentResultsSummary;
	onContinue: (level: string) => void;
}

export function AssessmentResults({
	results,
	onContinue,
}: AssessmentResultsProps) {
	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center">
					<Brain className="mr-2 h-6 w-6 text-blue-600" />
					Your Learning Profile
				</CardTitle>
				<CardDescription>
					Based on your assessment, we've created a personalized
					learning profile for you
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="bg-blue-50 p-6 rounded-lg text-center">
					<h3 className="text-xl font-bold mb-2">
						Recommended Language Level
					</h3>
					<div className="text-4xl font-bold text-blue-700 mb-3">
						{results.languageLevel}
					</div>
					<p className="text-sm text-slate-600">
						{getLevelDescription(results.languageLevel)}
					</p>

					<div className="flex justify-center mt-4">
						<div className="flex items-center">
							{["A1", "A2", "B1", "B2", "C1", "C2"].map(
								(level, index) => (
									<React.Fragment key={level}>
										{index > 0 && (
											<div className="w-6 h-1 bg-gray-200"></div>
										)}
										<div
											className={`w-10 h-10 rounded-full flex items-center justify-center 
                      ${
							level === results.languageLevel
								? "bg-blue-600 text-white font-bold border-4 border-blue-200"
								: "bg-gray-100 text-gray-500"
						}`}
										>
											{level}
										</div>
									</React.Fragment>
								)
							)}
						</div>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="bg-white p-4 border rounded-lg">
						<h4 className="font-medium mb-2 text-slate-600 flex items-center">
							<Users className="mr-2 h-4 w-4 text-blue-500" />
							Cognitive Profile
						</h4>
						<div className="space-y-3">
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Language Processing</span>
									<span>
										{results.cognitiveProfile.language}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.language * 10
									}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Memory</span>
									<span>
										{results.cognitiveProfile.memory}/10
									</span>
								</div>
								<Progress
									value={results.cognitiveProfile.memory * 10}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Attention</span>
									<span>
										{results.cognitiveProfile.attention}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.attention * 10
									}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Executive Function</span>
									<span>
										{results.cognitiveProfile.executive}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.executive * 10
									}
									className="h-2"
								/>
							</div>
						</div>
					</div>

					<div className="bg-white p-4 border rounded-lg">
						<h4 className="font-medium mb-3 text-slate-600 flex items-center">
							<BookOpen className="mr-2 h-4 w-4 text-blue-500" />
							How We'll Personalize Content
						</h4>
						<ul className="space-y-2 text-sm">
							{results.cognitiveProfile.memory >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong memory - you'll retain new
										vocabulary well
									</span>
								</li>
							)}
							{results.cognitiveProfile.memory < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll provide extra vocabulary
										reinforcement
									</span>
								</li>
							)}
							{results.cognitiveProfile.language >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong language skills - you can handle
										complex text
									</span>
								</li>
							)}
							{results.cognitiveProfile.language < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll simplify sentence structures when
										needed
									</span>
								</li>
							)}
							{results.cognitiveProfile.attention >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Great attention span - longer content
										works well
									</span>
								</li>
							)}
							{results.cognitiveProfile.attention < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll chunk content into smaller
										sections
									</span>
								</li>
							)}
							{results.cognitiveProfile.executive >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong reasoning - complex concepts are
										fine
									</span>
								</li>
							)}
							{results.cognitiveProfile.executive < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll provide more visual aids for
										concepts
									</span>
								</li>
							)}
						</ul>
					</div>
				</div>

				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
					<h4 className="font-medium text-yellow-800 mb-2">
						What's Next?
					</h4>
					<p className="text-sm text-yellow-700 mb-2">
						Now that we understand your learning style, it's time to
						upload educational content that you'd like to adapt to
						your level and cognitive preferences.
					</p>
					<p className="text-sm text-yellow-700">
						We'll transform the content to match your profile and
						provide additional resources to enhance your learning
						experience.
					</p>
				</div>
			</CardContent>

			<CardFooter className="justify-between flex-col sm:flex-row gap-3">
				<Button variant="outline" onClick={() => onContinue("B1")}>
					Use Default Level (B1)
				</Button>
				<Button
					onClick={() => onContinue(results.languageLevel)}
					className="group"
				>
					Continue with My Profile
					<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
				</Button>
			</CardFooter>
		</Card>
	);
}

function getLevelDescription(level: string) {
	const descriptions: Record<string, string> = {
		A1: "Beginner - Can understand and use familiar everyday expressions and basic phrases",
		A2: "Elementary - Can communicate in simple and routine tasks requiring simple and direct exchange of information",
		B1: "Intermediate - Can deal with most situations likely to arise while traveling in an area where the language is spoken",
		B2: "Upper Intermediate - Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers possible",
		C1: "Advanced - Can express ideas fluently and spontaneously without much obvious searching for expressions",
		C2: "Proficient - Can understand with ease virtually everything heard or read",
	};

	return descriptions[level] || "Intermediate level language abilities";
}

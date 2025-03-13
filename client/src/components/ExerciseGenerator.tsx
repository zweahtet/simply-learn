// src/components/ExerciseGenerator.tsx
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadIcon, RotateCcwIcon, ArrowLeftIcon } from "lucide-react";

interface ExerciseGeneratorProps {
	exercises: string;
	level: string;
	onBack: () => void;
	onRestart: () => void;
}

export function ExerciseGenerator({
	exercises,
	level,
	onBack,
	onRestart,
}: ExerciseGeneratorProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [selectedTab, setSelectedTab] = useState("all");


	// Function to extract specific exercise sections
	const extractExerciseSection = (sectionTitle: string): string => {
		const parser = new DOMParser();
		const doc = parser.parseFromString(exercises, "text/html");

		// Find the section with the matching title
		const sections = doc.querySelectorAll(".exercise");
		for (let i = 0; i < sections.length; i++) {
			const titleElement = sections[i].querySelector(".exercise-title");
			if (
				titleElement &&
				titleElement.textContent?.includes(sectionTitle)
			) {
				return sections[i].outerHTML;
			}
		}

		return "<p>Section not found</p>";
	};

	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					Practice Exercises
					<span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
						{level} Level
					</span>
				</CardTitle>
				<CardDescription>
					Customized exercises to reinforce learning and check
					comprehension.
				</CardDescription>
			</CardHeader>

			<Tabs defaultValue="all" onValueChange={setSelectedTab}>
				<div className="px-6">
					<TabsList className="w-full">
						<TabsTrigger value="all">All Exercises</TabsTrigger>
						<TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
						<TabsTrigger value="comprehension">
							Comprehension
						</TabsTrigger>
						<TabsTrigger value="writing">Writing</TabsTrigger>
						<TabsTrigger value="speaking">Speaking</TabsTrigger>
					</TabsList>
				</div>

				<CardContent className="pt-6">
					<TabsContent value="all" className="mt-0">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{ __html: exercises }}
						/>
					</TabsContent>

					<TabsContent value="vocabulary" className="mt-0">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{
								__html: extractExerciseSection("Vocabulary"),
							}}
						/>
					</TabsContent>

					<TabsContent value="comprehension" className="mt-0">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{
								__html: extractExerciseSection("Comprehension"),
							}}
						/>
					</TabsContent>

					<TabsContent value="writing" className="mt-0">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{
								__html: extractExerciseSection("Writing"),
							}}
						/>
					</TabsContent>

					<TabsContent value="speaking" className="mt-0">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{
								__html: extractExerciseSection("Speaking"),
							}}
						/>
					</TabsContent>
				</CardContent>
			</Tabs>

			<CardFooter className="flex justify-between">
				<Button variant="outline" onClick={onBack} size="sm">
					<ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Content
				</Button>
				<Button variant="outline" onClick={onRestart} size="sm">
					<RotateCcwIcon className="h-4 w-4 mr-2" /> Start Over
				</Button>
			</CardFooter>
		</Card>
	);
}

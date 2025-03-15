// simply-learn/client/src/components/ContentDisplay.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTubeRecommendations } from "@/components/YouTubeRecommendations";
import { BookOpen, Video } from "lucide-react";

interface ContentDisplayProps {
	content: string;
	originalContent: string; // Added to pass to YouTubeRecommendations
	level: string;
	onGenerateExercises: () => void;
}

export function ContentDisplay({
	content,
	originalContent,
	level,
	onGenerateExercises,
}: ContentDisplayProps) {
	return (
		<div className="space-y-6">
			<Card className="w-full max-w-4xl mx-auto">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Adapted Content</CardTitle>
						<Badge>Level: {level}</Badge>
					</div>
					<CardDescription>
						This content has been adapted to match {level} (
						{getLevelDescription(level)}) proficiency.
					</CardDescription>
				</CardHeader>

				<Tabs defaultValue="content" className="w-full">
					<div className="px-6">
						<TabsList className="grid w-full grid-cols-2 mb-4">
							<TabsTrigger
								value="content"
								className="flex items-center"
							>
								<BookOpen className="h-4 w-4 mr-2" />
								Content
							</TabsTrigger>
							<TabsTrigger
								value="videos"
								className="flex items-center"
							>
								<Video className="h-4 w-4 mr-2" />
								Video Explanations
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="content">
						<CardContent>
							<div className="bg-white rounded-md border p-6 shadow-sm">
								<div
									className="prose max-w-none"
									dangerouslySetInnerHTML={{
										__html: content,
									}}
								/>
							</div>
						</CardContent>
					</TabsContent>

					<TabsContent value="videos">
						<CardContent>
							<YouTubeRecommendations
								content={originalContent}
								level={level}
							/>
						</CardContent>
					</TabsContent>
				</Tabs>

				<CardFooter className="flex justify-center mt-4">
					<Button onClick={onGenerateExercises} size="lg">
						Generate Practice Exercises
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

function getLevelDescription(level: string) {
	const descriptions: Record<string, string> = {
		A1: "Beginner",
		A2: "Elementary",
		B1: "Intermediate",
		B2: "Upper Intermediate",
		C1: "Advanced",
		C2: "Proficient",
	};

	return descriptions[level] || "";
}

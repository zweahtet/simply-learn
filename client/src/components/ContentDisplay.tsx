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
import { ConceptVideos } from "@/components/ConceptVideos";

interface ContentDisplayProps {
	content: string;
	level: string;
	onGenerateExercises: () => void;
}

export function ContentDisplay({
	content,
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

				<CardContent>
					<div className="bg-white rounded-md border p-6 shadow-sm">
						<div
							className="prose max-w-none"
							dangerouslySetInnerHTML={{ __html: content }}
						/>
					</div>
				</CardContent>

				<CardFooter className="flex justify-center">
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

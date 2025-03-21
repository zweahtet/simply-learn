// simply-learn/client/src/components/ContentDisplay.tsx
"use client";
import { useState, useEffect } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTubeRecommendations } from "@/components/YouTubeRecommendations";
import { BookOpen, Video, FileText } from "lucide-react";
import { SimplifiedContent } from "./SimplifiedContent";
import { FileMetadata } from "@/types";

interface ContentDisplayProps {
	content: string;
	originalContent: string; // Added to pass to YouTubeRecommendations
	level: string;
	files?: FileMetadata[];
	onFileChange?: (fileId: string) => void;
	onGenerateExercises: () => void;
}

export function ContentDisplay({
	content,
	originalContent,
	level,
	files = [],
	onFileChange,
	onGenerateExercises,
}: ContentDisplayProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
		files.length > 0 ? files[0].fileId : undefined
	);

	const summary = content;

	// Update selected file when files array changes
	useEffect(() => {
		if (files.length > 0 && !selectedFileId) {
			setSelectedFileId(files[0].fileId);
			if (onFileChange) onFileChange(files[0].fileId);
		}
	}, [files, selectedFileId, onFileChange]);

	const handleFileChange = (fileId: string) => {
		setSelectedFileId(fileId);
		if (onFileChange) onFileChange(fileId);
	};

	const handleGenerateExercises = async () => {
		setIsLoading(true);

		try {
			await onGenerateExercises();
		} catch (error) {
			console.error("Error generating exercises:", error);
		} finally {
			setIsLoading(false);
		}
	};

	// Check if currently selected file is still processing
	const selectedFile = files.find((file) => file.fileId === selectedFileId);
	const isProcessingComplete =
		!selectedFile || selectedFile.isComplete === true;

	return (
		<div className="space-y-6">
			<Card className="w-full max-w-4xl mx-auto">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Adapted Content</CardTitle>
						<Badge>Level: {level}</Badge>
					</div>
					{files.length > 0 && (
						<div className="mt-4">
							<div className="text-sm text-gray-500 mb-2">
								{files.length === 1
									? "1 document processed"
									: `${files.length} documents processed`}
							</div>

							<Select
								value={selectedFileId}
								onValueChange={handleFileChange}
							>
								<SelectTrigger className="w-full">
									<FileText className="mr-2 h-4 w-4" />
									<SelectValue placeholder="Select a file" />
								</SelectTrigger>
								<SelectContent>
									{files.map((file) => (
										<SelectItem
											key={file.fileId}
											value={file.fileId}
										>
											<div className="flex items-center justify-between w-full">
												<span className="truncate max-w-[200px]">
													{file.title ||
														file.filename}
												</span>
												{!file.isComplete && (
													<Badge
														variant="outline"
														className="ml-2 bg-amber-100"
													>
														Processing
													</Badge>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<CardDescription>
						This content has been adapted to match {level} (
						{getLevelDescription(level)}) proficiency.
					</CardDescription>
				</CardHeader>

				<Tabs defaultValue="summary" className="w-full">
					<div className="px-6">
						<TabsList className="grid w-full grid-cols-3 mb-4">
							<TabsTrigger
								value="summary"
								className="flex items-center"
							>
								<BookOpen className="h-4 w-4" />
								Summary
							</TabsTrigger>
							<TabsTrigger
								value="simplified"
								className="flex items-center"
							>
								<BookOpen className="h-4 w-4" />
								Simplified
							</TabsTrigger>
							<TabsTrigger
								value="videos"
								className="flex items-center"
							>
								<Video className="h-4 w-4" />
								Video Explanations
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="summary">
						<CardContent>
							<div className="bg-white rounded-md border p-6 shadow-sm">
								<SimplifiedContent
									content={content}
									fileId={selectedFileId}
								/>
							</div>
						</CardContent>
					</TabsContent>

					<TabsContent value="simplified">
						<CardContent>
							<div className="bg-white rounded-md border p-6 shadow-sm">
								<SimplifiedContent
									content={content}
									fileId={selectedFileId}
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
					<Button onClick={handleGenerateExercises} size="lg">
						{isLoading
							? "Generating..."
							: "Generate Practice Exercises"}
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

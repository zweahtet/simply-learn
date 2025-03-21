// simply-learn/client/src/components/Dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentUploader } from "@/components/ContentUploader";
import { ContentDisplay } from "@/components/ContentDisplay";
import { ExerciseGenerator } from "@/components/ExerciseGenerator";
import { FileMetadata } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UploadCloud, BookOpen, PenTool, LogOut } from "lucide-react";

export function Dashboard() {
	const { profile, signOut } = useAuth();
	const [activeTab, setActiveTab] = useState("upload");
	const [originalContent, setOriginalContent] = useState("");
	const [adaptedContent, setAdaptedContent] = useState("");
	const [exercises, setExercises] = useState("");
	const [processedFiles, setProcessedFiles] = useState<FileMetadata[]>([]);
	const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Check if we can enable the Content tab (needs content)
	const isContentTabEnabled =
		originalContent !== "" || processedFiles.length > 0;

	// Check if we can enable the Exercises tab (needs content to have been processed)
	const isExercisesTabEnabled = adaptedContent !== "";

	// Handle file uploads and processing results
	const handleContentUpload = async (
		uploadedContent?: string,
		fileMetadata?: FileMetadata
	) => {
		setError(null);

		if (fileMetadata) {
			// Add new file to processed files
			setProcessedFiles((prev) => [
				...prev,
				{
					...fileMetadata,
					isComplete: false,
				},
			]);

			// Select the new file
			setSelectedFileId(fileMetadata.fileId);

			// Switch to content tab
			setActiveTab("content");
		} else if (uploadedContent) {
			// Direct content input without file processing
			setOriginalContent(uploadedContent);

			// Process the content for adaptation
			try {
				setIsLoading(true);
				const response = await fetch("/api/simplify-content", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						content: uploadedContent,
						cognitiveProfile: profile?.cognitiveProfile,
					}),
				});

				const data = await response.json();

				if (data.success) {
					setAdaptedContent(data.adaptedContent);
					setActiveTab("content");
				} else {
					setError(data.error || "Error adapting content");
				}
			} catch (error) {
				console.error("Error:", error);
				setError("Error connecting to server");
			} finally {
				setIsLoading(false);
			}
		}
	};

	// Handle file selection change
	const handleFileChange = (fileId: string) => {
		setSelectedFileId(fileId);
	};

	// Update file status when processing completes
	const handleProcessingComplete = (fileId: string, finalContent: string) => {
		// Update the status of the file
		setProcessedFiles((prev) =>
			prev.map((file) =>
				file.fileId === fileId ? { ...file, isComplete: true } : file
			)
		);

		// Update content if this is the currently selected file
		if (fileId === selectedFileId) {
			setAdaptedContent(finalContent);
		}
	};

	// Handle generating exercises
	const handleGenerateExercises = async () => {
		setError(null);
		setIsLoading(true);

		try {
			const response = await fetch("/api/generate-exercises", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: originalContent,
					cognitiveProfile: profile?.cognitiveProfile,
				}),
			});

			const data = await response.json();

			if (data.success) {
				setExercises(data.exercises);
				setActiveTab("exercises");
			} else {
				setError(data.error || "Error generating exercises");
			}
		} catch (error) {
			console.error("Error:", error);
			setError("Error connecting to server");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="flex justify-between items-center mb-8">
				<div>
					<h1 className="text-3xl font-bold">EquiLearn Dashboard</h1>
				</div>
				<Button variant="outline" onClick={signOut}>
					<LogOut className="h-4 w-4 mr-2" />
					Sign Out
				</Button>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3 mb-8">
					<TabsTrigger value="upload" className="flex items-center">
						<UploadCloud className="h-4 w-4 mr-2" />
						Upload Content
					</TabsTrigger>
					<TabsTrigger
						value="content"
						disabled={!isContentTabEnabled}
						className="flex items-center"
					>
						<BookOpen className="h-4 w-4 mr-2" />
						Adapted Content
					</TabsTrigger>
					<TabsTrigger
						value="exercises"
						disabled={!isExercisesTabEnabled}
						className="flex items-center"
					>
						<PenTool className="h-4 w-4 mr-2" />
						Practice Exercises
					</TabsTrigger>
				</TabsList>

				<TabsContent value="upload" className="mt-4">
					<ContentUploader onUpload={handleContentUpload} />
				</TabsContent>

				<TabsContent value="content" className="mt-4">
					<ContentDisplay
                        content={adaptedContent}
                        level={profile?.languageLevel || "B1"}
						originalContent={originalContent}
						onGenerateExercises={handleGenerateExercises}
						files={processedFiles}
						onFileChange={handleFileChange}
					/>
				</TabsContent>

				<TabsContent value="exercises" className="mt-4">
					<ExerciseGenerator
						exercises={exercises}
						level={profile?.languageLevel || "B1"}
						onBack={() => setActiveTab("content")}
						onRestart={() => setActiveTab("upload")}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

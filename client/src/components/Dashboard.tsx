// simply-learn/client/src/components/dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentUploader } from "@/components/ContentUploader";
import { ContentDisplay } from "@/components/ContentDisplay";
import { ExerciseGenerator } from "@/components/ExerciseGenerator";
import { FileList } from "@/components/file-list";
import { FileMetadata } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { BookOpen, PenTool, Video } from "lucide-react";
import { SimplifiedTab } from "@/components/simplified-tab";
import { SummaryTab } from "@/components/summary-tab";
import { VideosTab } from "@/components/videos-tap";

// State for files
// const [files, setFiles] = useState<FileMetadata[]>([]);
// const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

// // Handle file upload completion
// const handleFileUpload = (newFiles: FileMetadata[]) => {
// 	setFiles((prevFiles) => {
// 		// Add only files that don't already exist in the array
// 		const uniqueNewFiles = newFiles.filter(
// 			(newFile) =>
// 				!prevFiles.some((prevFile) => prevFile.name === newFile.name)
// 		);
// 		return [...prevFiles, ...uniqueNewFiles];
// 	});

// 	// Set the first uploaded file as active if no file is currently active
// 	if (!selectedFile && newFiles.length > 0) {
// 		setSelectedFile(newFiles[0]);
// 	}
// };

// const handleFileDelete = (fileId: string) => {
// 	setFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
// 	if (selectedFile?.id === fileId) {
// 		setSelectedFile(null);
// 	}

// 	// TODO: invoke the file delete API here
// }

// return (
// 	<div className="flex h-screen overflow-hidden">
// 		{/* Left sidebar */}
// 		<FileListSidebar
// 			files={files}
// 			setFiles={setFiles}
// 			selectedFile={selectedFile}
// 			onFileSelect={setSelectedFile}
// 			onFileUpload={handleFileUpload}
// 			onFileDelete={handleFileDelete}
// 		/>
// 	</div>
// );

export function Dashboard() {
	const [activeTab, setActiveTab] = useState("summary");
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

	return (
		<div className="flex flex-col md:flex-row gap-6 max-w-[1800px]">
			<FileList
				onFileSelect={setSelectedFile}
				selectedFile={selectedFile}
			/>
			<Tabs
				defaultValue="summary"
				value={activeTab}
				onValueChange={setActiveTab}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3 mb-8">
					<TabsTrigger value="upload" className="flex items-center">
						Summary
					</TabsTrigger>
					<TabsTrigger value="content" className="flex items-center">
						<BookOpen className="h-4 w-4 mr-2" />
						Simplified
					</TabsTrigger>
					<TabsTrigger
						value="study-guides"
						className="flex items-center"
					>
						<PenTool className="h-4 w-4 mr-2" />
						Study Plan
					</TabsTrigger>
				</TabsList>

				<TabsContent value="summary" className="h-full">
					<SummaryTab fileId={selectedFile?.id} />
				</TabsContent>

				<TabsContent value="simplified" className="h-full">
					<SimplifiedTab fileId={selectedFile?.id} />
				</TabsContent>

				<TabsContent value="videos" className="h-full">
					<VideosTab fileId={selectedFile?.id} />
				</TabsContent>

				{/* <TabsContent value="study-guides" className="h-full">
					<ExerciseGenerator
						exercises={exercises}
						level={profile?.languageLevel || "B1"}
						onBack={() => setActiveTab("content")}
						onRestart={() => setActiveTab("upload")}
					/>
				</TabsContent> */}
			</Tabs>
		</div>
	);
}

// simply-learn/client/src/app/dashboard/page.tsx
"use client";
import { useState } from "react";
import { FileListSidebar } from "@/components/dashboard/FileListSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { FileMetadata } from "@/types";

export default function Dashboard() {
	// State for files
	const [files, setFiles] = useState<FileMetadata[]>([]);
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

	// Handle file upload completion
	const handleFileUpload = (newFiles: FileMetadata[]) => {
		setFiles((prevFiles) => {
			// Add only files that don't already exist in the array
			const uniqueNewFiles = newFiles.filter(
				(newFile) =>
					!prevFiles.some((prevFile) => prevFile.name === newFile.name)
			);
			return [...prevFiles, ...uniqueNewFiles];
		});

		// Set the first uploaded file as active if no file is currently active
		if (!selectedFile && newFiles.length > 0) {
			setSelectedFile(newFiles[0]);
		}
	};

	const handleFileDelete = (fileId: string) => {
		setFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
		if (selectedFile?.id === fileId) {
			setSelectedFile(null);
		}

		// TODO: invoke the file delete API here
	}

	return (
		<div className="flex h-screen overflow-hidden">
			{/* Left sidebar */}
			<FileListSidebar
				files={files}
				setFiles={setFiles}
				selectedFile={selectedFile}
				onFileSelect={setSelectedFile}
				onFileUpload={handleFileUpload}
				onFileDelete={handleFileDelete}
			/>
		</div>
	);
}

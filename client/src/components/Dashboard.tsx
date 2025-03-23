// simply-learn/client/src/components/dashboard.tsx
"use client";

import { useState } from "react";
import { MainContent } from "@/components/dashboard-main";
import { FileList } from "@/components/file-list";
import { FileMetadata } from "@/types";

export function Dashboard() {
	const [files, setFiles] = useState<FileMetadata[]>([]); // TODO: Fetch files from the server with swr
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

	return (
		<div className="flex min-h-screen">
			<FileList
				files={files}
				setFiles={setFiles}
				onFileSelect={setSelectedFile}
				selectedFile={selectedFile}
			/>
			<MainContent selectedFile={selectedFile} />
		</div>
	);
}

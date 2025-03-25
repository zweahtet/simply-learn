// simply-learn/client/src/components/dashboard.tsx
"use client";

import { useState } from "react";
import { MainContent } from "@/components/dashboard-main";
import { FileListCard } from "@/components/file-list";
import { FileMetadata } from "@/types";

export function Dashboard() {
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
	const [fileMetadataMap, setFileMetadataMap] = useState<Map<string, FileMetadata>>(new Map<string, FileMetadata>());

	return (
		<div className="flex min-h-screen">
			<FileListCard
				fileMetadataMap={fileMetadataMap}
				setFileMetadataMap={setFileMetadataMap}
				onFileSelect={setSelectedFile}
				selectedFile={selectedFile}
			/>
			<MainContent selectedFile={selectedFile} />
		</div>
	);
}

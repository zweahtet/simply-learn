// simply-learn/client/src/components/dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { MainContent } from "@/components/dashboard-main";
import { FileListCard } from "@/components/file-list";
import { FileMetadata } from "@/types";


export function Dashboard() {
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

	return (
		<div className="flex min-h-screen">
			<FileListCard
				onFileSelect={setSelectedFile}
				selectedFile={selectedFile}
			/>
			<MainContent selectedFile={selectedFile} />
		</div>
	);
}

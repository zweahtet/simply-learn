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
		<div className="grid grid-cols-3 gap-4 m-4">
			<div className="col-span-1">
				<FileList
					files={files}
					setFiles={setFiles}
					onFileSelect={setSelectedFile}
					selectedFile={selectedFile}
				/>
			</div>
			<div className="col-span-2">
				<MainContent selectedFile={selectedFile} />
			</div>
		</div>
	);
}

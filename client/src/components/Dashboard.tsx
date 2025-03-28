// simply-learn/client/src/components/dashboard.tsx
"use client";

import { toast } from "sonner";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { MainContent } from "@/components/dashboard-main";
import { FileListCard } from "@/components/file-list";
import { FileMetadata } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { SupabaseConfig } from "@/lib/defaults";

const supabase = createClient();

const userFilesFetcher = async (userId: string): Promise<Map<string, FileMetadata>> => {
	const { data, error } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).list(userId);
	if (error) {
		throw new Error(error.message);
	}

	if (!data) return new Map<string, FileMetadata>();

	// filter out .emptyFolderPlaceholder
	const filteredData = data.filter(folder => folder.name !== ".emptyFolderPlaceholder");

	const fileMetadataMap = new Map<string, FileMetadata>();
	for (const folder of filteredData) {
		// get the content inside the folder
		const { data, error } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).list(`${userId}/${folder.name}`);

		if (error) {
			throw new Error(error.message);
		}

		if (!data) continue;
		
		// there should be only one pdf file and we will use that to display the file
		const pdfFile = data.find(file => file.name.endsWith(".pdf"));
		if (pdfFile) {
			fileMetadataMap.set(folder.name, {
				id: folder.name,
				name: pdfFile.name,
				type: pdfFile.metadata.mimetype,
				size: pdfFile.metadata.size,
			})
		}
	}
	return fileMetadataMap;
}

export function Dashboard() {
	const { user } = useAuth();
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

	const { data: fileMetadataMap, isLoading } = useSWR<
		Map<string, FileMetadata>
	>(user ? `${user.id}` : null, userFilesFetcher, {
		onError: (err) => {
			console.error("Error fetching files:", err);
			toast.error("Something went wrong while loading files.");
		},
		// revalidateOnFocus: false,
		revalidateOnReconnect: false,
		revalidateIfStale: false,
	});

	if (!fileMetadataMap) return null;

	return (
		<div className="flex min-h-screen">
			<FileListCard
				fileMetadataMap={fileMetadataMap}
				onFileSelect={setSelectedFile}
				selectedFile={selectedFile}
			/>
			<MainContent selectedFile={selectedFile} />
		</div>
	);
}

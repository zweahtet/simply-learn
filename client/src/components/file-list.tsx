"use client";
import React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileMetadata } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Upload } from "lucide-react";




interface SidebarProps {
	selectedFile: FileMetadata | null;
	onFileSelect: (file: FileMetadata | null) => void;
}

export function FileList({
    onFileSelect,
    selectedFile,
    ...props
}: SidebarProps) {
	const [files, setFiles] = React.useState<FileMetadata[]>([]); // TODO: Fetch files from the server with swr
    const fileInputRef = React.useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = React.useState(false);
	const [uploadProgress, setUploadProgress] = React.useState(0);
	const isMobile = useIsMobile();

	const handleFileDelete = (fileId: string) => {
		setFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
		if (selectedFile?.id === fileId) {
			onFileSelect(null);
		}

		// TODO: invoke the file delete API here
	}
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = e.target.files;
		if (!selectedFiles || selectedFiles.length === 0) return;

		// Check total size
		let totalSize = 0;
		for (let i = 0; i < selectedFiles.length; i++) {
			totalSize += selectedFiles[i].size;
		}

		if (totalSize > 10 * 1024 * 1024) {
            toast.error("Files exceed the maximum size limit of 10MB");
			return;
		}

		// Process files
		setIsUploading(true);
		setUploadProgress(0);

		const newFiles: FileMetadata[] = [];

		// Convert FileList to array of FileType
		Array.from(selectedFiles).forEach((file) => {
			const fileType = file.type.includes("pdf") ? "pdf" : "text";
			newFiles.push({
				id: `${uuidv4()}`,
				name: file.name,
				type: fileType,
                size: file.size,
                totalPages: 0,
				status: "processing",
			});
		});

		// Simulate upload progress
		const interval = setInterval(() => {
			setUploadProgress((prev) => {
				if (prev >= 100) {
					clearInterval(interval);
					return 100;
				}
				return prev + 10;
			});
		}, 300);

		// Simulate processing delay and update status to ready
		setTimeout(() => {
			const processedFiles = newFiles.map((file) => ({
				...file,
				status: "ready" as const,
			}));

			// Update the files with ready status
			setFiles((prevFiles) => {
				return prevFiles.map((file) => {
					const processedFile = processedFiles.find(
						(pf) => pf.id === file.id
					);
					return processedFile || file;
				});
			});

			setIsUploading(false);
			setUploadProgress(100);

			// Reset the file input
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}, 3000);
	};

	// Add a function to format file size
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return (
			Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
			" " +
			sizes[i]
		);
	};

	return (
		<Sidebar variant="floating" {...props}>
			<SidebarHeader>
				<h2 className="text-lg font-semibold">Files</h2>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<div className="flex flex-col gap-4 p-4">
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleFileChange}
							className="hidden"
							multiple
							accept=".pdf,.txt,.doc,.docx"
							aria-label="Upload files"
						/>

						<Button
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
							className="w-full"
						>
							<Upload className="mr-2 h-4 w-4" />
							Upload Files
						</Button>

						{isUploading && (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Uploading...
									</span>
									<span className="text-sm font-medium">
										{uploadProgress}%
									</span>
								</div>
								<Progress
									value={uploadProgress}
									className="h-2"
								/>
							</div>
						)}
					</div>
					<SidebarMenu className="gap-2">
						{files.map((file) => (
							<SidebarMenuItem key={file.id}></SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">Total Size:</span>
					<span className="text-sm">
						{formatFileSize(
							files.reduce((total, file) => total + file.size, 0)
						)}{" "}
						/ 10 MB
					</span>
				</div>
				<Progress
					value={
						(files.reduce((total, file) => total + file.size, 0) /
							(10 * 1024 * 1024)) *
						100
					}
					className="h-1.5 mt-2"
				/>
			</SidebarFooter>
		</Sidebar>
	);
}
// simply-learn/client/src/components/file-list.tsx
"use client";
import React from "react";
import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileMetadata } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlusCircle, FileText, FileIcon } from "lucide-react";

interface SidebarProps {
	files: FileMetadata[];
	setFiles: React.Dispatch<React.SetStateAction<FileMetadata[]>>;
	selectedFile: FileMetadata | null;
	onFileSelect: (file: FileMetadata | null) => void;
}

export function FileList({
	files,
	setFiles,
	onFileSelect,
	selectedFile,
}: SidebarProps) {
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
	};

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

		// Check if files already exist
		const existingFiles = files.filter((file) =>
			newFiles.some((newFile) => newFile.name === file.name)
		);

		if (existingFiles.length > 0) {
			toast.error("Some files already exist");
			setIsUploading(false);
			return;
		}

		// Add new files to the list
		setFiles((prevFiles) => [...prevFiles, ...newFiles]);

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

	const totalSize = files.reduce((total, file) => total + file.size, 0);
	const totalSizeFormatted = formatFileSize(totalSize);
	const percentUsed = (totalSize / (10 * 1024 * 1024)) * 100;

	return (
		<div className="relative w-full max-w-xs">
			<Card className="w-full max-w-md rounded-none shadow-none border-t-0 border-l-0 border-b-0">
				<CardHeader className="flex flex-row items-start justify-between">
					<CardTitle>Files</CardTitle>
					<div>
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
							size="sm"
						>
							<PlusCircle className="mr-2 h-4 w-4" />
							Add File
						</Button>
					</div>
				</CardHeader>
				<CardContent className="flex-1 p-0">
					<ScrollArea className="h-[calc(100vh-10rem)]">
						<div className="p-4">
							<div className="grid gap-4">
								{files.length === 0 ? (
									<div className="p-4 text-center text-muted-foreground text-sm w-full">
										No files uploaded yet
									</div>
								) : (
									files.map((item) => (
										<div
											key={item.id}
											className={cn(
												"rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md",
												selectedFile?.id === item.id &&
													"bg-muted"
											)}
											onClick={() => {
												if (item.status === "ready") {
													onFileSelect(item);
												}
											}}
										>
											<div className="flex items-start justify-between">
												<div>
													<h3 className="font-semibold">
														{item.name}
													</h3>
													<p className="text-sm text-muted-foreground">
														{formatFileSize(
															item.size
														)}
													</p>
												</div>
												{item.status ===
													"processing" && (
													<div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-t-transparent border-primary animate-spin" />
												)}
												<Button
													variant="destructive"
													size="icon"
													className="flex-shrink-0 ml-2"
													onClick={(e) => {
														e.stopPropagation();
														handleFileDelete(
															item.id
														);
													}}
												>
													Delete
												</Button>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</ScrollArea>
				</CardContent>
				<CardFooter className="flex-col">
					<div>
						<Progress
							value={percentUsed}
							className="h-1.5 w-full"
						/>
						<span className="text-sm">
							{percentUsed.toFixed(2)}% storage capacity used
						</span>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}

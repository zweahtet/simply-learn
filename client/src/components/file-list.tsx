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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileMetadata } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlusCircle, FileText, FileIcon, EllipsisVertical, Trash } from "lucide-react";

interface FileListCardProps {
	// filesMetadata: FileMetadata[];
	// setFilesMetadata: React.Dispatch<React.SetStateAction<FileMetadata[]>>;
	fileMetadataMap: Map<string, FileMetadata>;
	setFileMetadataMap: React.Dispatch<
		React.SetStateAction<Map<string, FileMetadata>>
	>;
	selectedFile: FileMetadata | null;
	onFileSelect: (file: FileMetadata | null) => void;
}

export function FileListCard({
	// filesMetadata,
	// setFilesMetadata,
	fileMetadataMap,
	setFileMetadataMap,
	onFileSelect,
	selectedFile,
}: FileListCardProps) {
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = React.useState(false);
	// const [uploadProgress, setUploadProgress] = React.useState(0);
	const [uploadProgressMap, setUploadProgressMap] = React.useState<
		Map<string, number>
	>(new Map<string, number>());
	const isMobile = useIsMobile();

	// can we memoize this function?
	const generateFileId = React.useCallback((fileName: string, fileSize: number): string => {
		// Combine filename and size for better uniqueness
		const str = `${fileName}-${fileSize}`;
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return (hash >>> 0).toString(16);
	}, []);

	const handleFileDelete = (fileId: string) => {
		// setFilesMetadata((prevFiles) =>
		// 	prevFiles.filter((file) => file.id !== fileId)
		// );
		setFileMetadataMap((prevFiles) => {
			const newMap = new Map(prevFiles);
			newMap.delete(fileId);
			return newMap;
		});

		if (selectedFile?.id === fileId) {
			onFileSelect(null);
		}

		// TODO: invoke the file delete API here
	};

	const uploadFiles = async (toUpload: Map<string, File>) => {
		// Create a map to store progress for each file
		const progressMap = new Map<string, number>();

		// Use Promise.all to handle multiple uploads
		const uploadPromises = Array.from(toUpload.entries()).map(([fileId, file]) => {
			return new Promise<FileMetadata>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				const formData = new FormData();

				formData.append("file", file);
				formData.append("file_id", fileId);

				// Track progress for this specific file
				xhr.upload.addEventListener("progress", (event) => {
					if (event.lengthComputable) {
						const fileProgress = Math.round(
							(event.loaded / event.total) * 100
						);
						// Update progress for just this file
						progressMap.set(file.name, fileProgress);
						setUploadProgressMap(new Map(progressMap));
					}
				});

				xhr.addEventListener("load", () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve(JSON.parse(xhr.responseText));
					} else {
						reject(`Error uploading ${file.name}: ${xhr.status}`);
					}
				});

				xhr.addEventListener("error", () => {
					reject(`Network error uploading ${file.name}`);
				});

				xhr.open(
					"POST",
					"http://localhost:8000/api/v1/files/process-file"
				);
				xhr.send(formData);
			});
		});

		try {
			const results = await Promise.all(uploadPromises);
			return results;
		} catch (error) {
			console.error("Upload error:", error);
			throw error;
		}
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

		// Check for duplicate files
		Array.from(selectedFiles).forEach((file) => {
			const fileId = generateFileId(file.name, file.size);
			if (fileMetadataMap.has(fileId)) {
				// File already exists
				toast.error(`File already exists: ${file.name}`);
				// Reset the file input
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				// Stop uploading
				setIsUploading(false);
				return;
			}
		});

		// Process files
		setUploadProgressMap(new Map<string, number>());

		// create a map to store files and ids to be uploaded
		const toUpload = new Map<string, File>();
		Array.from(selectedFiles).forEach((file) => {
			const fileId = generateFileId(file.name, file.size);
			toUpload.set(fileId, file);
		});

		// update the state of the file metadata map for client-side rendering			
		Array.from(selectedFiles).forEach((file) => {
			setFileMetadataMap((prevFiles) => {
				const newMap = new Map(prevFiles);
				// Generate a unique ID for the file
				const fileId = generateFileId(file.name, file.size);

				newMap.set(fileId, {
					id: fileId,
					name: file.name,
					type: file.type.includes("pdf") ? "pdf" : "text",
					size: file.size,
				});
				return newMap;
			});
		});

		try {
			// Upload files and get server responses
			const results = await uploadFiles(toUpload);

			// Update with any additional server-side properties
			// results.forEach((result) => {
			// 	setFileMetadataMap((prevFiles) => {
			// 		const newMap = new Map(prevFiles);
			// 		newMap.set(result.id, {
			// 			...newMap.get(result.id),
			// 			...result,
			// 		});
			// 		return newMap;
			// 	});
			// });
		} catch (error) {
			toast.error("Error uploading files");
			// Remove temp files that failed to upload
			// setFilesMetadata((prevFiles) =>
			// 	prevFiles.filter((file) => !file.id.startsWith("temp-"))
			// );
			// Remove temp files that failed to upload
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			// Clear progress map
			setUploadProgressMap(new Map<string, number>());
		}
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

	const totalSize = Array.from(fileMetadataMap.values()).reduce(
		(total, file) => total + file.size,
		0
	);
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
								{fileMetadataMap.size === 0 ? (
									<div className="p-4 text-center text-muted-foreground text-sm w-full">
										No files uploaded yet
									</div>
								) : (
									Array.from(fileMetadataMap.values()).map(
										(item) => (
											<div
												key={item.id}
												className={cn(
													"rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md relative overflow-hidden",
													selectedFile?.id ===
														item.id && "bg-muted"
												)}
												// onClick={() => {
												// 	if (item.status === "ready") {
												// 		onFileSelect(item);
												// 	}
												// }}
												onClick={() =>
													onFileSelect(item)
												}
											>
												{/* Progress overlay */}
												{uploadProgressMap.has(
													item.name
												) && (
													<div
														className="absolute inset-0 bg-primary/20 pointer-events-none"
														style={{
															width: `${uploadProgressMap.get(
																item.name
															)}%`,
															transition:
																"width 0.3s ease-in-out",
														}}
													/>
												)}
												<div className="flex items-start justify-between">
													<div>
														<h3 className="font-semibold line-clamp-1">
															{item.name}
														</h3>
														<p className="text-sm text-muted-foreground">
															{formatFileSize(
																item.size
															)}
														</p>
													</div>
													<DropdownMenu>
														<DropdownMenuTrigger
															asChild
															className="flex-shrink-0 ml-2"
														>
															<Button
																variant="ghost"
																size="icon"
															>
																<EllipsisVertical className="h-3 w-3" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																className="text-destructive"
																onClick={(
																	e
																) => {
																	e.stopPropagation();
																	handleFileDelete(
																		item.id
																	);
																}}
															>
																<Trash className="h-4 w-4" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</div>
										)
									)
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

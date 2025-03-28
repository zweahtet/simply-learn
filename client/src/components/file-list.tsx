// simply-learn/client/src/components/file-list.tsx
"use client";
import {useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
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
import {
	PlusCircle,
	FileText,
	FileIcon,
	EllipsisVertical,
	Trash,
} from "lucide-react";
import { SupabaseConfig } from "@/lib/defaults";

const supabase = createClient();

interface FileListCardProps {
	fileMetadataMap: Map<string, FileMetadata>;
	selectedFile: FileMetadata | null;
	onFileSelect: (file: FileMetadata | null) => void;
}

type FileUploadStatus =
	| "pending"
	| "uploading"
	| "completed"
	| "error"
	| undefined;

export function FileListCard({
	fileMetadataMap,
	onFileSelect,
	selectedFile,
}: FileListCardProps) {
	const { user } = useAuth();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploadStatusMap, setUploadStatusMap] = useState<
		Map<string, FileUploadStatus>
		>(new Map<string, undefined>());
	const [percentUsed, setPercentUsed] = useState<number>(0);

	// can we memoize this function?
	const generateFileId = useCallback(
		(fileName: string, fileSize: number): string => {
			// Combine filename and size for better uniqueness
			const str = `${fileName}-${fileSize}`;
			let hash = 0;
			for (let i = 0; i < str.length; i++) {
				const char = str.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash;
			}
			return (hash >>> 0).toString(16);
		},
		[]
	);

	const handleFileDelete = (fileId: string) => {
		const bucket = "attachments";
		const folderPath = `${user?.id}/${fileId}`;

		// list all files in the folder
		supabase.storage
			.from(bucket)
			.list(folderPath)
			.then((listResponse) => {
				if (listResponse.error) {
					console.error("Error listing files:", listResponse.error);
				}

				if (!listResponse.data) {
					return;
				}

				// create array of file paths to delete
				const filesToDelete = listResponse.data.map(
					(file) => `${folderPath}/${file.name}`
				);

				// delete all files in the folder
				supabase.storage
					.from(bucket)
					.remove(filesToDelete)
					.then((deleteResponse) => {
						if (deleteResponse.error) {
							console.error(
								"Error deleting files:",
								deleteResponse.error
							);
						}

						if (selectedFile?.id === fileId) {
							onFileSelect(null);
						}
						toast.success("File deleted successfully");
					});
			})
			.catch((error) => {
				console.error("Error when deleting file:", error);
				toast.error("Something went wrong while deleting the file");
			});
	};

	const uploadFiles = async (toUpload: Map<string, File>) => {
		// Create a map to store progress for each file
		const statusMap = new Map<string, FileUploadStatus>();

		// Set initial
		toUpload.forEach((_, fileId) => {
			statusMap.set(fileId, "pending");
		});
		setUploadStatusMap(new Map(statusMap));

		// Use Promise.all to handle multiple uploads
		const uploadPromises = Array.from(toUpload.entries()).map(
			([fileId, file]) => {
				return new Promise<{ id: string }>(async (resolve, reject) => {
					try {
						const filePath = `${user?.id}/${fileId}/${file.name}`;
						const supabaseSignedUploadUrlResponse =
							await supabase.storage
								.from(SupabaseConfig.ATTACHMENT_BUCKET)
								.createSignedUploadUrl(filePath, {
									upsert: true,
								});

						if (supabaseSignedUploadUrlResponse.error) {
							toast.error("Error creating signed upload URL");
							reject(supabaseSignedUploadUrlResponse.error);
							return;
						}
						// Update progress map
						statusMap.set(fileId, "uploading");
						setUploadStatusMap(new Map(statusMap));

						const { token, path } =
							supabaseSignedUploadUrlResponse.data;
						const reponse = await supabase.storage
							.from(SupabaseConfig.ATTACHMENT_BUCKET)
							.uploadToSignedUrl(path, token, file, {
								upsert: true,
								contentType: file.type,
								metadata: {
									name: file.name,
									size: file.size.toString(),
									type: file.type,
								},
							});
						if (reponse.error) {
							reject(reponse.error);
						}

						// Update progress map
						statusMap.set(fileId, "completed");
						setUploadStatusMap(new Map(statusMap));

						// Resolve with file id
						resolve({ id: fileId });
					} catch (error) {
						statusMap.set(fileId, "error");
						setUploadStatusMap(new Map(statusMap));
						reject(error);
					}
				});
			}
		);

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
				return;
			}
		});

		// Process files
		setUploadStatusMap(new Map<string, FileUploadStatus>());

		// create a map to store files and ids to be uploaded
		const toUpload = new Map<string, File>();
		Array.from(selectedFiles).forEach((file) => {
			const fileId = generateFileId(file.name, file.size);
			toUpload.set(fileId, file);
		});

		try {
			// Upload files and get server responses
			const results = await uploadFiles(toUpload);
			console.log("Upload results:", results);
		} catch (error) {
			toast.error("Error uploading files");
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			// Clear progress map
			setUploadStatusMap(new Map<string, FileUploadStatus>());
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

	useEffect(() => {
		const totalSize = Array.from(fileMetadataMap.values()).reduce(
			(total, file) => total + file.size,
			0
		);
		// const totalSizeFormatted = formatFileSize(totalSize);
		// const percentUsed = (totalSize / (10 * 1024 * 1024)) * 100;
		const percentUsed = (totalSize / (10 * 1024 * 1024)) * 100;
		setPercentUsed(percentUsed);
	}, [fileMetadataMap]);

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
								{Array.from(fileMetadataMap.values()).length === 0 ? (
									<div className="p-4 text-center text-muted-foreground text-sm w-full">
										No files uploaded yet
									</div>
								) : (
									Array.from(fileMetadataMap.values()).map(
										(item) => (
											<div
												key={item.id}
												className={cn(
													"rounded-lg border bg-card p-4 transition-all hover:shadow-md relative overflow-hidden",
													selectedFile?.id ===
														item.id && "bg-muted"
												)}
												onClick={() =>
													onFileSelect(item)
												}
											>
												{/* Show loading animation depending on the upload status */}
												{uploadStatusMap.get(
													item.id
												) && (
													<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
														{uploadStatusMap.get(
															item.id
														) === "pending" && (
															<div className="flex flex-col items-center gap-2">
																<FileIcon className="h-6 w-6 text-muted-foreground animate-pulse" />
																<p className="text-sm font-medium">
																	Preparing...
																</p>
															</div>
														)}
														{uploadStatusMap.get(
															item.id
														) === "uploading" && (
															<div className="flex flex-col items-center gap-2">
																<svg
																	className="animate-spin h-6 w-6 text-primary"
																	xmlns="http://www.w3.org/2000/svg"
																	fill="none"
																	viewBox="0 0 24 24"
																>
																	<circle
																		className="opacity-25"
																		cx="12"
																		cy="12"
																		r="10"
																		stroke="currentColor"
																		strokeWidth="4"
																	></circle>
																	<path
																		className="opacity-75"
																		fill="currentColor"
																		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																	></path>
																</svg>
																<p className="text-sm font-medium">
																	Uploading...
																</p>
															</div>
														)}
														{uploadStatusMap.get(
															item.id
														) === "completed" && (
															<div className="flex flex-col items-center gap-2 text-green-500">
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-6 w-6"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={
																			2
																		}
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
																<p className="text-sm font-medium">
																	Uploaded
																</p>
															</div>
														)}
														{uploadStatusMap.get(
															item.id
														) === "error" && (
															<div className="flex flex-col items-center gap-2 text-destructive">
																<svg
																	xmlns="http://www.w3.org/2000/svg"
																	className="h-6 w-6"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={
																			2
																		}
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
																<p className="text-sm font-medium">
																	Error
																</p>
															</div>
														)}
													</div>
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

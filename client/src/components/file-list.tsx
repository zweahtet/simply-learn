// simply-learn/client/src/components/file-list.tsx
"use client";
import useSWR from "swr";
import { useState, useEffect, useCallback, useRef, memo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	PlusCircle,
	FileText,
	FileIcon,
	EllipsisVertical,
	Trash,
} from "lucide-react";
import { SupabaseConfig } from "@/lib/defaults";
import { getFiles, deleteFile, uploadFile } from "@/lib/backend/files";

const supabase = createClient();

// Add a function to format file size
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return (
		Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
	);
};

interface FileListCardProps {
	selectedFile: FileMetadata | null;
	onFileSelect: (file: FileMetadata | null) => void;
}

type FileUploadStatus =
	| "pending"
	| "uploading"
	| "completed"
	| "error"
	| undefined;

interface AttachmentItemProps {
	item: FileMetadata;
	isActive: boolean;
	onDelete: (fileId: string) => void;
	uploadStatusMap: Map<string, FileUploadStatus>;
}

const PureAttachmentItem = ({
	item,
	isActive,
	onDelete,
	uploadStatusMap,
}: AttachmentItemProps) => {
	return (
		<div
			key={item.id}
			className={cn(
				"rounded-lg border bg-card p-4 transition-all hover:shadow-md relative overflow-hidden",
				isActive && "bg-muted"
			)}
			// onClick={() => onFileSelect(item)}
		>
			{/* Show loading animation depending on the upload status */}
			{uploadStatusMap.get(item.id) && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					{uploadStatusMap.get(item.id) === "pending" && (
						<div className="flex flex-col items-center gap-2">
							<FileIcon className="h-6 w-6 text-muted-foreground animate-pulse" />
							<p className="text-sm font-medium">Preparing...</p>
						</div>
					)}
					{uploadStatusMap.get(item.id) === "uploading" && (
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
							<p className="text-sm font-medium">Uploading...</p>
						</div>
					)}
					{uploadStatusMap.get(item.id) === "completed" && (
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
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
							<p className="text-sm font-medium">Uploaded</p>
						</div>
					)}
					{uploadStatusMap.get(item.id) === "error" && (
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
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
							<p className="text-sm font-medium">Error</p>
						</div>
					)}
				</div>
			)}
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-semibold line-clamp-1">{item.name}</h3>
					<p className="text-sm text-muted-foreground">
						{formatFileSize(item.size)}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild className="flex-shrink-0 ml-2">
						<Button variant="ghost" size="icon">
							<EllipsisVertical className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							className="text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(item.id);
							}}
						>
							<Trash className="h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
};

export const AttachmentItem = memo(
	PureAttachmentItem,
	(prevProps, nextProps) => {
		// Only re-render if the item ID changes OR if the upload status changes
		return (
			prevProps.item.id === nextProps.item.id &&
			prevProps.uploadStatusMap.get(prevProps.item.id) ===
				nextProps.uploadStatusMap.get(nextProps.item.id) &&
			prevProps.isActive === nextProps.isActive
		);
	}
);

export function FileListCard({
	onFileSelect,
	selectedFile,
}: FileListCardProps) {
	const { user } = useAuth();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploadStatusMap, setUploadStatusMap] = useState<
		Map<string, FileUploadStatus>
	>(new Map<string, undefined>());
	const [percentUsed, setPercentUsed] = useState<number>(0);

	const {
		data: fileMetadataList,
		isLoading,
		mutate,
	} = useSWR<Array<FileMetadata>>(user ? `${user.id}` : null, getFiles, {
		onError: (err) => {
			console.error("Error fetching files:", err);
			toast.error("Something went wrong while loading files.");
		},
		// fallbackData: new Map<string, FileMetadata>(),
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		revalidateIfStale: false,
	});

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
		if (!user || !fileMetadataList) return;
		toast.promise(deleteFile(user.id, fileId), {
			loading: "Deleting file...",
			success: () => {
				mutate((fileMetadataList) => {
					if (fileMetadataList) {
						return fileMetadataList.filter(
							(metadata) => metadata.id !== fileId
						);
					}
				}, false);

				if (selectedFile?.id === fileId) {
					onFileSelect(null);
				}
				return "File deleted successfully";
			},
			error: (error) => {
				console.error("Error when deleting file:", error);
				return "Something went wrong while deleting the file. Try again later.";
			},
		});
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!user || !fileMetadataList) return;
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
			if (fileMetadataList.find((f) => f.id === fileId)) {
				// File already exists
				toast.error(`File already exists: ${file.name}`);
				// Reset the file input
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				return;
			}
		});

		// Create a new status map
		const newStatusMap = new Map<string, FileUploadStatus>();

		// Add all files with "pending" status
		Array.from(selectedFiles).forEach((file) => {
			const fileId = generateFileId(file.name, file.size);
			newStatusMap.set(fileId, "pending");
		});

		// Set initial status map
		setUploadStatusMap(newStatusMap);

		// Optimistically update UI
		mutate((prevFiles) => {
			if (prevFiles) {
				return [
					...prevFiles,
					...Array.from(selectedFiles).map((file) => ({
						id: generateFileId(file.name, file.size),
						name: file.name,
						type: file.type,
						size: file.size,
						createdAt: new Date().toISOString(),
					})),
				];
			}
		}, false); // false means don't revalidate yet

		// Create upload promises
		const uploadPromises = Array.from(selectedFiles).map((file) => {
			const fileId = generateFileId(file.name, file.size);

			// Update to "uploading" status
			setUploadStatusMap((prevMap) => {
				const updatedMap = new Map(prevMap);
				updatedMap.set(fileId, "uploading");
				return updatedMap;
			});

			return uploadFile(user.id, file, fileId)
				.then((fileMetadata) => {
					// Update to "completed" status
					setUploadStatusMap((prevMap) => {
						const updatedMap = new Map(prevMap);
						updatedMap.set(fileId, "completed");
						return updatedMap;
					});
					return fileMetadata;
				})
				.catch((error) => {
					console.error("Upload error:", error);
					// Update to "error" status
					setUploadStatusMap((prevMap) => {
						const updatedMap = new Map(prevMap);
						updatedMap.set(fileId, "error");
						return updatedMap;
					});
					throw error;
				});
		});

		// Reset file input immediately
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}

		// Wait for all uploads to complete
		try {
			await Promise.all(uploadPromises);
			// Revalidate data from server
			mutate();

			// Set a timeout before clearing the status map
			// This gives users a chance to see the "completed" status
			setTimeout(() => {
				setUploadStatusMap(new Map());
			}, 1500); // 1.5 seconds delay
		} catch (error) {
			console.error("Some uploads failed:", error);
			// Still revalidate
			mutate();

			// Keep error statuses visible for longer
			setTimeout(() => {
				// Only clear statuses for completed uploads
				setUploadStatusMap((prevMap) => {
					const finalMap = new Map(prevMap);
					for (const [fileId, status] of finalMap.entries()) {
						if (status === "completed") {
							finalMap.delete(fileId);
						}
					}
					return finalMap;
				});
			}, 3000); // 3 seconds delay for errors
		}
	};

	useEffect(() => {
		if (!fileMetadataList) return;
		const totalSize = fileMetadataList.reduce(
			(total, file) => total + file.size,
			0
		);
		const percentUsed = (totalSize / (10 * 1024 * 1024)) * 100;
		setPercentUsed(percentUsed);
	}, [fileMetadataList]);

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
								{isLoading ? (
									<>
										{Array.from({ length: 5 }).map(
											(_, index) => (
												<Skeleton
													key={index}
													className="h-16 w-full rounded-lg"
												/>
											)
										)}
									</>
								) : fileMetadataList?.length === 0 ? (
									<div className="p-4 text-center text-muted-foreground text-sm w-full">
										No files uploaded yet
									</div>
								) : (
									<>
										{fileMetadataList?.map((item) => (
											<AttachmentItem
												key={item.id}
												item={item}
												isActive={
													selectedFile?.id === item.id
												}
												onDelete={handleFileDelete}
												uploadStatusMap={
													uploadStatusMap
												}
											/>
										))}
									</>
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

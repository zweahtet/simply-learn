// simply-learn/client/src/components/ContentUploader.tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadIcon, FileTextIcon, BookIcon, AlertCircle } from "lucide-react";
import { LimitedActionButton } from "@/components/LimitedActionButton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";

// Constants for validation
const MAX_WORD_COUNT = 5000;
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_COUNT = 3;
const MB_IN_BYTES = 1048576; // 1MB in bytes
const ALLOWED_FILE_TYPES = ["text/plain", "application/pdf"];

// Helper to count words
const countWords = (text: string = ""): number => {
	return text.trim().split(/\s+/).filter(Boolean).length;
};

// Word limits for different fields
const TITLE_MAX_WORDS = 15;
const SOURCE_MAX_WORDS = 30;

// Zod schema for content validation
const contentFormSchema = z.object({
	title: z
		.string()
		.min(1, { message: "Title is required" })
		.refine((text) => countWords(text) <= TITLE_MAX_WORDS, {
			message: `Title must not exceed ${TITLE_MAX_WORDS} words`,
		}),
	source: z
		.string()
		.min(1, { message: "Source is required" })
		.refine((text) => countWords(text) <= SOURCE_MAX_WORDS, {
			message: `Source must not exceed ${SOURCE_MAX_WORDS} words`,
		}),
	content: z
		.string()
		.min(1, { message: "Content is required" })
		.refine((text) => countWords(text) <= MAX_WORD_COUNT, {
			message: `Content must not exceed ${MAX_WORD_COUNT} words`,
		}),
});

// Infer TypeScript type from the schema
type ContentFormValues = z.infer<typeof contentFormSchema>;

interface ContentUploaderProps {
	onUpload: (content: string) => void;
}

export function ContentUploader({ onUpload }: ContentUploaderProps) {
	const [activeTab, setActiveTab] = useState("text");
	const [error, setError] = useState("");
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);
	const [contentWordCount, setContentWordCount] = useState<number>(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Initialize the form with Zod validation
	const form = useForm<ContentFormValues>({
		resolver: zodResolver(contentFormSchema),
		defaultValues: {
			title: "",
			source: "",
			content: "",
		},
	});

	// Get file icon based on file type
	const getFileIcon = (fileType: string) => {
		if (fileType === "application/pdf") {
			return <FileTextIcon className="h-10 w-10 text-red-500" />;
		}
		return <FileTextIcon className="h-10 w-10 text-blue-500" />;
	};

	// Check if file type is allowed
	const isFileTypeAllowed = (file: File) => {
		if (ALLOWED_FILE_TYPES.includes(file.type)) return true;
		// Additional check for .txt files that might have incorrect MIME type
		if (file.name.endsWith(".txt")) return true;
		// Additional check for .pdf files that might have incorrect MIME type
		if (file.name.endsWith(".pdf")) return true;
		return false;
	};

	// File upload handler with validation
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		setFileError(null);

		// Create a list of all files (existing + new)
		const allFiles = [...uploadedFiles];
		const newFilesToAdd: File[] = [];

		// Check if adding these files would exceed the max file count
		if (allFiles.length + files.length > MAX_FILE_COUNT) {
			setFileError(`Maximum of ${MAX_FILE_COUNT} files allowed`);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		// Check total size of all files (existing + new)
		let totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);

		// Validate each new file
		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			// Check if adding this file would exceed the max size
			totalSize += file.size;
			if (totalSize > MAX_FILE_SIZE_MB * MB_IN_BYTES) {
				setFileError(
					`Files exceed maximum size of ${MAX_FILE_SIZE_MB}MB`
				);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				return;
			}

			// Check file type
			if (!isFileTypeAllowed(file)) {
				setFileError("Only PDF and text files are supported");
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				return;
			}

			newFilesToAdd.push(file);
		}

		// Add the new files to the existing files
		setUploadedFiles([...allFiles, ...newFilesToAdd]);

		// Reset the file input
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const onSubmit = async (values: ContentFormValues) => {
		// Check for file validation errors
		if (fileError) return;

		setError("");

		try {
			// Process content on the server
			const response = await fetch("/api/process-content", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: values.content,
					title: values.title || "Untitled",
					source: values.source || "Unknown",
				}),
			});

			const data = await response.json();

			if (data.success) {
				onUpload(values.content);
			} else {
				setError(data.error || "Error processing content");
			}
		} catch (error) {
			console.error("Error:", error);
			setError("Error connecting to server");
		}
	};

	const loadSampleContent = () => {
		form.setValue("content", samplePhotosynthesisText);
		form.setValue("title", "Introduction to Photosynthesis");
		form.setValue(
			"source",
			"Biology Textbook, 4th Edition by Smith et al."
		);
		setContentWordCount(countWords(samplePhotosynthesisText));
		form.trigger();
	};

	// Update word count whenever content changes
	const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newContent = e.target.value;
		form.setValue("content", newContent);
		setContentWordCount(countWords(newContent));
	};

	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle>Upload Educational Content</CardTitle>
				<CardDescription>
					Enter the text content you want to adapt for ESL learners.
				</CardDescription>
			</CardHeader>

			<CardContent>
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<Tabs
							defaultValue="text"
							onValueChange={setActiveTab}
							className="mb-6"
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="text">
									<FileTextIcon className="h-4 w-4 mr-2" />
									Enter Text
								</TabsTrigger>
								<TabsTrigger value="file">
									<UploadIcon className="h-4 w-4 mr-2" />
									Upload File
								</TabsTrigger>
							</TabsList>

							<TabsContent value="text">
								<div className="grid gap-4">
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="title"
											render={({ field }) => (
												<FormItem>
													<div className="flex justify-between">
														<FormLabel>
															Title{" "}
															<span className="text-red-500">
																*
															</span>
														</FormLabel>
														<span
															className={`text-xs ${
																countWords(
																	field.value
																) >
																TITLE_MAX_WORDS
																	? "text-red-500 font-medium"
																	: "text-gray-500"
															}`}
														>
															{countWords(
																field.value
															)}
															/{TITLE_MAX_WORDS}{" "}
															words
														</span>
													</div>
													<FormControl>
														<Input
															placeholder="Article title"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="source"
											render={({ field }) => (
												<FormItem>
													<div className="flex justify-between">
														<FormLabel>
															Source{" "}
															<span className="text-red-500">
																*
															</span>
														</FormLabel>
														<span
															className={`text-xs ${
																countWords(
																	field.value
																) >
																SOURCE_MAX_WORDS
																	? "text-red-500 font-medium"
																	: "text-gray-500"
															}`}
														>
															{countWords(
																field.value
															)}
															/{SOURCE_MAX_WORDS}{" "}
															words
														</span>
													</div>
													<FormControl>
														<Input
															placeholder="Where this content is from"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={form.control}
										name="content"
										render={({ field }) => (
											<FormItem>
												<div className="flex justify-between">
													<FormLabel>
														Content
													</FormLabel>
													<span
														className={`text-xs ${
															contentWordCount >
															MAX_WORD_COUNT
																? "text-red-500 font-medium"
																: "text-gray-500"
														}`}
													>
														{contentWordCount}/
														{MAX_WORD_COUNT} words
													</span>
												</div>
												<FormControl>
													<Textarea
														placeholder="Paste your educational content here..."
														className="min-h-[300px]"
														{...field}
														onChange={(e) => {
															field.onChange(e);
															handleContentChange(
																e
															);
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</TabsContent>

							<TabsContent value="file">
								<div className="space-y-4">
									<div
										className={`border-2 border-dashed ${
											fileError
												? "border-red-300"
												: "border-gray-300"
										} rounded-lg p-6 text-center`}
									>
										<label
											htmlFor="file-upload"
											className="cursor-pointer"
										>
											<UploadIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
											<p className="text-sm text-gray-600 mb-1">
												Click to upload or drag and drop
											</p>
											<p className="text-xs text-gray-500 mb-4">
												PDF & TXT files (max{" "}
												{MAX_FILE_SIZE_MB}MB,{" "}
												{MAX_FILE_COUNT} files)
											</p>
											<Input
												id="file-upload"
												ref={fileInputRef}
												type="file"
												accept=".pdf,.txt"
												hidden
												aria-hidden="true"
												onChange={handleFileUpload}
												multiple={MAX_FILE_COUNT > 1}
											/>
										</label>
									</div>

									{fileError && (
										<p className="text-red-500 text-xs flex items-center">
											<AlertCircle className="h-3 w-3 mr-1" />
											{fileError}
										</p>
									)}

									{uploadedFiles.length > 0 && (
										<div className="space-y-4 mt-4">
											<p className="text-sm font-medium">
												Uploaded files:
											</p>
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
												{uploadedFiles.map(
													(file, index) => (
														<div
															key={index}
															className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
														>
															<div className="flex items-center mb-3">
																{getFileIcon(
																	file.type
																)}
																<div className="ml-3">
																	<p
																		className="font-medium text-sm truncate"
																		title={
																			file.name
																		}
																	>
																		{
																			file.name
																		}
																	</p>
																	<p className="text-xs text-gray-500">
																		{(
																			file.size /
																			MB_IN_BYTES
																		).toFixed(
																			2
																		)}{" "}
																		MB
																	</p>
																</div>
															</div>
															<div className="text-xs text-gray-600 mt-auto flex justify-between items-center">
																<span>
																	{file.type ===
																	"application/pdf"
																		? "PDF Document"
																		: "Text File"}
																</span>
																<button
																	type="button"
																	onClick={() => {
																		setUploadedFiles(
																			uploadedFiles.filter(
																				(
																					f,
																					i
																				) =>
																					i !==
																					index
																			)
																		);
																	}}
																	className="text-red-500 hover:text-red-700 text-xs"
																>
																	Remove
																</button>
															</div>
														</div>
													)
												)}
											</div>
										</div>
									)}
								</div>
							</TabsContent>
						</Tabs>

						<div className="mt-6">
							<div className="flex justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={loadSampleContent}
								>
									<BookIcon className="h-4 w-4 mr-2" />
									Load Sample Content
								</Button>

								<div>
									<LimitedActionButton
										actionName="Process Content"
										onClick={form.handleSubmit(onSubmit)}
										disabled={
											!form.formState.isValid ||
											!!fileError
										}
									/>
								</div>
							</div>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

const samplePhotosynthesisText = `Photosynthesis is the process by which green plants, algae, and certain bacteria convert light energy, usually from the sun, into chemical energy in the form of glucose or other sugars. This process occurs in the chloroplasts of plant cells, specifically in the grana, which contain the photosynthetic pigment chlorophyll.

The overall equation for photosynthesis is:
6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂

This means that carbon dioxide and water, in the presence of light energy, are converted into glucose and oxygen. This process can be divided into two main stages: the light-dependent reactions and the light-independent reactions (Calvin cycle).

In the light-dependent reactions, which occur in the thylakoid membranes of the chloroplasts, light energy is captured by chlorophyll and converted into chemical energy in the form of ATP (adenosine triphosphate) and NADPH (nicotinamide adenine dinucleotide phosphate). Water is split into oxygen, protons, and electrons. The oxygen is released as a byproduct.

In the light-independent reactions, also known as the Calvin cycle, which take place in the stroma of the chloroplasts, the ATP and NADPH produced in the light-dependent reactions are used to convert carbon dioxide into glucose. This is a complex cycle involving multiple enzymes and intermediate compounds.

Photosynthesis is crucial for life on Earth as it produces oxygen, which many organisms need for respiration, and provides energy-rich organic compounds, which serve as the base of the food chain.`;
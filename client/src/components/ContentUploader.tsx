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
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_COUNT = 3;
const MB_IN_BYTES = 1048576; // 1MB in bytes

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

	// File upload handler with validation
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		setFileError(null);

		// Check file count
		if (files.length > MAX_FILE_COUNT) {
			setFileError(`Maximum of ${MAX_FILE_COUNT} files allowed`);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		// Check file size and type
		let totalSize = 0;
		const newFiles: File[] = [];
		let validationError = null;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			totalSize += file.size;

			// Check if total size exceeds limit
			if (totalSize > MAX_FILE_SIZE_MB * MB_IN_BYTES) {
				validationError = `Files exceed maximum size of ${MAX_FILE_SIZE_MB}MB`;
				break;
			}

			// Check file type
			if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
				validationError = "Only .txt files are supported";
				break;
			}

			newFiles.push(file);
		}

		if (validationError) {
			setFileError(validationError);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		setUploadedFiles(newFiles);

		// Read the first file's content
		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result;
			if (typeof result === "string") {
				// Update form content
				form.setValue("content", result);
				// Check if title is empty, use file name
				if (!form.getValues("title")) {
					form.setValue(
						"title",
						newFiles[0].name.replace(/\.[^/.]+$/, "")
					);
				}

				// Update word count
				setContentWordCount(countWords(result));

				// Trigger validation
				form.trigger("content");
			}
		};
		reader.onerror = () => {
			setError("Error reading file");
		};
		reader.readAsText(newFiles[0]);
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
												TXT files only (max{" "}
												{MAX_FILE_SIZE_MB}MB,{" "}
												{MAX_FILE_COUNT} files)
											</p>
											<Button variant="outline" size="sm">
												Select File
												{MAX_FILE_COUNT > 1 ? "s" : ""}
											</Button>
											<input
												id="file-upload"
												ref={fileInputRef}
												type="file"
												accept=".txt,text/plain"
												className="hidden"
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
										<div className="space-y-2">
											<p className="text-sm font-medium">
												Uploaded files:
											</p>
											<ul className="text-sm text-gray-600 space-y-1">
												{uploadedFiles.map(
													(file, index) => (
														<li
															key={index}
															className="flex items-center"
														>
															<FileTextIcon className="h-3 w-3 mr-1" />
															{file.name} (
															{(
																file.size /
																MB_IN_BYTES
															).toFixed(2)}
															MB)
														</li>
													)
												)}
											</ul>
										</div>
									)}

									{form.getValues("content") &&
										activeTab === "file" && (
											<div className="space-y-2">
												<div className="flex justify-between">
													<p className="text-sm font-medium">
														Preview:
													</p>
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
												<div className="border rounded-md p-3 max-h-[200px] overflow-y-auto text-sm">
													{form
														.getValues("content")
														.slice(0, 500)}
													{form.getValues("content")
														.length > 500 && "..."}
												</div>
												{form.formState.errors
													.content && (
													<p className="text-red-500 text-xs mt-1 flex items-center">
														<AlertCircle className="h-3 w-3 mr-1" />
														{
															form.formState
																.errors.content
																.message
														}
													</p>
												)}
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

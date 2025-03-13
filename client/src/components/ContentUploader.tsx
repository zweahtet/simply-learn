// src/components/ContentUploader.tsx
"use client";

import { useState } from "react";
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
import { UploadIcon, FileTextIcon, BookIcon } from "lucide-react";

interface ContentUploaderProps {
	onUpload: (content: string) => void;
}

export function ContentUploader({ onUpload }: ContentUploaderProps) {
	const [content, setContent] = useState("");
	const [title, setTitle] = useState("");
	const [source, setSource] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("text");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!content.trim()) {
			setError("Please enter some content");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			// Process content on the server
			const response = await fetch("/api/process-content", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content,
					title: title || "Untitled",
					source: source || "Unknown",
				}),
			});

			const data = await response.json();

			if (data.success) {
				onUpload(content);
			} else {
				setError(data.error || "Error processing content");
			}
		} catch (error) {
			console.error("Error:", error);
			setError("Error connecting to server");
		} finally {
			setIsLoading(false);
		}
	};

	const loadSampleContent = () => {
		setContent(samplePhotosynthesisText);
		setTitle("Introduction to Photosynthesis");
		setSource("Biology Textbook");
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Check file type
		if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
			setError("Please upload a text (.txt) file");
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result;
			if (typeof result === "string") {
				setContent(result);
				setTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove file extension for title
			}
		};
		reader.onerror = () => {
			setError("Error reading file");
		};
		reader.readAsText(file);
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
								<div className="space-y-2">
									<label
										htmlFor="title"
										className="text-sm font-medium"
									>
										Title (optional)
									</label>
									<Input
										id="title"
										value={title}
										onChange={(e) =>
											setTitle(e.target.value)
										}
										placeholder="Article title"
									/>
								</div>

								<div className="space-y-2">
									<label
										htmlFor="source"
										className="text-sm font-medium"
									>
										Source (optional)
									</label>
									<Input
										id="source"
										value={source}
										onChange={(e) =>
											setSource(e.target.value)
										}
										placeholder="Where this content is from"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<label
									htmlFor="content"
									className="text-sm font-medium"
								>
									Content
								</label>
								<Textarea
									id="content"
									value={content}
									onChange={(e) => setContent(e.target.value)}
									placeholder="Paste your educational content here..."
									className="min-h-[300px]"
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="file">
						<div className="space-y-4">
							<div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
								<label
									htmlFor="file-upload"
									className="cursor-pointer"
								>
									<UploadIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
									<p className="text-sm text-gray-600 mb-1">
										Click to upload or drag and drop
									</p>
									<p className="text-xs text-gray-500 mb-4">
										TXT files only (max 1MB)
									</p>
									<Button variant="outline" size="sm">
										Select File
									</Button>
									<input
										id="file-upload"
										type="file"
										accept=".txt,text/plain"
										className="hidden"
										onChange={handleFileUpload}
									/>
								</label>
							</div>

							{content && activeTab === "file" && (
								<div className="space-y-2">
									<p className="text-sm font-medium">
										Preview:
									</p>
									<div className="border rounded-md p-3 max-h-[200px] overflow-y-auto text-sm">
										{content.slice(0, 500)}
										{content.length > 500 && "..."}
									</div>
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>

			<CardFooter className="flex justify-between">
				<Button variant="outline" onClick={loadSampleContent}>
					<BookIcon className="h-4 w-4 mr-2" />
					Load Sample Content
				</Button>

				<Button
					onClick={handleSubmit}
					disabled={isLoading || !content.trim()}
				>
					{isLoading ? "Processing..." : "Process Content"}
				</Button>
			</CardFooter>
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

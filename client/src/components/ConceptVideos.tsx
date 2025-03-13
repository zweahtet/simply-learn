// src/components/ConceptVideos.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VideoRecommendation {
	videoId: string;
	title: string;
	description: string;
	topics: string[];
	levelRange: string[];
	durationSeconds: number;
	language: string;
	subtitles: boolean;
	relevanceScore: number;
	matchedTopics: string[];
}

interface Concept {
	term: string;
	description: string;
}

interface ConceptVideosProps {
	content: string;
	level: string;
}

export function ConceptVideos({ content, level }: ConceptVideosProps) {
	const [concepts, setConcepts] = useState<Concept[]>([]);
	const [videos, setVideos] = useState<VideoRecommendation[]>([]);
	const [activeTab, setActiveTab] = useState<string>("0");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [showVideos, setShowVideos] = useState<boolean>(false);

	useEffect(() => {
		const extractConcepts = async () => {
			setIsLoading(true);
			try {
				const response = await fetch("/api/recommend-yt-videos", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ content }),
				});

				const data = await response.json();
				if (data.success && data.concepts) {
					setConcepts(data.concepts);
					// Automatically fetch videos for the concepts
					fetchVideos(data.concepts);
				}
			} catch (error) {
				console.error("Error extracting concepts:", error);
			} finally {
				setIsLoading(false);
			}
		};

		if (content && !showVideos) {
			extractConcepts();
		}
	}, [content, level, showVideos]);

	const fetchVideos = async (conceptList: Concept[]) => {
		try {
			const response = await fetch("/api/recommend-videos", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					concepts: conceptList,
					level,
				}),
			});

			const data = await response.json();
			if (data.success && data.recommendedVideos) {
				setVideos(data.recommendedVideos);
			}
		} catch (error) {
			console.error("Error fetching videos:", error);
		}
	};

	// If no concepts or processing, don't show anything
	if ((concepts.length === 0 || videos.length === 0) && !isLoading) {
		return null;
	}

	// Format seconds as MM:SS
	const formatDuration = (seconds: number) => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	if (!showVideos) {
		return (
			<Card className="mt-6 border-dashed border-2 border-blue-300 bg-blue-50">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center justify-between">
						<span>Learning Resources Available</span>
						<Badge variant="outline" className="bg-blue-100">
							NEW
						</Badge>
					</CardTitle>
					<CardDescription>
						We've found {videos.length} helpful videos explaining
						key concepts in this text
					</CardDescription>
				</CardHeader>
				<CardFooter className="pt-2">
					<Button
						onClick={() => setShowVideos(true)}
						className="w-full"
					>
						Show Concept Videos
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		<Card className="mt-6">
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Concept Explanation Videos</span>
					<Badge variant="outline">{level} Level</Badge>
				</CardTitle>
				<CardDescription>
					Watch these videos to better understand difficult concepts
				</CardDescription>
			</CardHeader>

			<CardContent>
				{isLoading ? (
					<div className="flex justify-center py-8">
						<div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
					</div>
				) : (
					<Tabs
						defaultValue="0"
						value={activeTab}
						onValueChange={setActiveTab}
					>
						<TabsList className="w-full">
							{videos.map((video, index) => (
								<TabsTrigger
									key={index}
									value={index.toString()}
									className="flex-1"
								>
									<span className="truncate max-w-[150px]">
										{video.title.split("|")[0]}
									</span>
								</TabsTrigger>
							))}
						</TabsList>

						{videos.map((video, index) => (
							<TabsContent
								key={index}
								value={index.toString()}
								className="pt-4"
							>
								<div className="space-y-4">
									<div className="aspect-video relative rounded-md overflow-hidden">
										<iframe
											width="100%"
											height="100%"
											src={`https://www.youtube.com/embed/${video.videoId}`}
											title={video.title}
											frameBorder="0"
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
											allowFullScreen
										></iframe>
									</div>

									<div>
										<h3 className="font-semibold text-lg">
											{video.title}
										</h3>
										<div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
											<span>
												{formatDuration(
													video.durationSeconds
												)}
											</span>
											<span>•</span>
											<span>
												{video.subtitles
													? "With subtitles"
													: "No subtitles"}
											</span>
										</div>
										<p className="mt-2 text-sm text-slate-700">
											{video.description}
										</p>

										<div className="mt-3 flex flex-wrap gap-1">
											{video.matchedTopics.map(
												(topic, i) => (
													<Badge
														key={i}
														variant="secondary"
													>
														{topic}
													</Badge>
												)
											)}
										</div>
									</div>
								</div>
							</TabsContent>
						))}
					</Tabs>
				)}
			</CardContent>

			<CardFooter className="flex justify-end">
				<Button
					variant="outline"
					onClick={() => setShowVideos(false)}
					size="sm"
				>
					Hide Videos
				</Button>
			</CardFooter>
		</Card>
	);
}
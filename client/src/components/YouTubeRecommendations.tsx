// src/components/YouTubeRecommendations.tsx
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface VideoRecommendation {
	videoId: string;
	title: string;
	description: string;
	channelTitle: string;
	thumbnailUrl: string;
	duration: string;
	topics: string[];
	difficultyLevel: string[];
	relevanceScore: number;
	matchedTopics: string[];
}

interface YouTubeRecommendationsProps {
	content: string;
	level: string;
}

export function YouTubeRecommendations({
	content,
	level,
}: YouTubeRecommendationsProps) {
	const [videos, setVideos] = useState<VideoRecommendation[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [showVideos, setShowVideos] = useState<boolean>(false);
	const [topics, setTopics] = useState<string[]>([]);

	useEffect(() => {
		const fetchVideoRecommendations = async () => {
			if (!content || !level) return;

			setIsLoading(true);
			try {
				const response = await fetch("/api/video-recommendations", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ content, level }),
				});

				const data = await response.json();
				if (data.success && data.recommendedVideos) {
					setVideos(data.recommendedVideos);
					if (data.topics) {
						setTopics(data.topics);
					}
				} else {
					console.error(
						"Error fetching video recommendations:",
						data.error
					);
				}
			} catch (error) {
				console.error("Error fetching video recommendations:", error);
			} finally {
				setIsLoading(false);
			}
		};

		if (content && showVideos) {
			fetchVideoRecommendations();
		}
	}, [content, level, showVideos]);

	// If not showing videos or still loading initial check, show the prompt card
	if (!showVideos) {
		return (
			<Card className="mt-6 border-dashed border-2 border-blue-300 bg-blue-50">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center justify-between">
						<span>Learning Videos Available</span>
						<Badge variant="outline" className="bg-blue-100">
							AI-POWERED
						</Badge>
					</CardTitle>
					<CardDescription>
						We can find educational YouTube videos that explain
						concepts in this text
					</CardDescription>
				</CardHeader>
				<CardFooter className="pt-2">
					<Button
						onClick={() => setShowVideos(true)}
						className="w-full"
					>
						Find Learning Videos
					</Button>
				</CardFooter>
			</Card>
		);
	}

	// While loading, show loading state
	if (isLoading) {
		return (
			<Card className="mt-6">
				<CardHeader>
					<CardTitle>Finding Educational Videos</CardTitle>
					<CardDescription>
						Searching for videos matching your content and level...
					</CardDescription>
				</CardHeader>
				<CardContent className="flex justify-center py-8">
					<div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
				</CardContent>
			</Card>
		);
	}

	// If no videos found, show empty state
	if (videos.length === 0) {
		return (
			<Card className="mt-6">
				<CardHeader>
					<CardTitle>No Videos Found</CardTitle>
					<CardDescription>
						We couldn't find relevant educational videos for this
						content
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-center text-gray-500 py-4">
						Try with different content or adjust the language level
					</p>
				</CardContent>
				<CardFooter>
					<Button
						variant="outline"
						onClick={() => setShowVideos(false)}
						className="w-full"
					>
						Hide
					</Button>
				</CardFooter>
			</Card>
		);
	}

	// Display video recommendations
	return (
		<Card className="mt-6">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Educational Video Recommendations</CardTitle>
					<Badge variant="outline">{level} Level</Badge>
				</div>
				<CardDescription>
					YouTube videos that explain concepts in this text at your
					language level
				</CardDescription>
				{topics.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{topics.map((topic, i) => (
							<Badge
								key={i}
								variant="secondary"
								className="text-xs"
							>
								{topic}
							</Badge>
						))}
					</div>
				)}
			</CardHeader>

			<CardContent>
				<div className="grid gap-4">
					{videos.map((video) => (
						<div
							key={video.videoId}
							className="bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
						>
							<div className="sm:flex">
								<div className="sm:w-1/3 relative">
									<img
										src={video.thumbnailUrl}
										alt={video.title}
										className="w-full h-auto object-cover"
									/>
									{video.duration && (
										<div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
											{video.duration}
										</div>
									)}
								</div>
								<div className="p-4 sm:w-2/3">
									<h3 className="font-medium text-base line-clamp-2">
										{video.title}
									</h3>
									<p className="text-sm text-gray-500 mt-1">
										{video.channelTitle}
									</p>
									<p className="text-sm text-gray-700 mt-2 line-clamp-2">
										{video.description}
									</p>

									{video.matchedTopics?.length > 0 && (
										<div className="mt-3 flex flex-wrap gap-1">
											{video.matchedTopics.map(
												(topic, i) => (
													<Badge
														key={i}
														variant="secondary"
														className="text-xs"
													>
														{topic}
													</Badge>
												)
											)}
										</div>
									)}

									<div className="mt-3">
										<a
											href={`https://www.youtube.com/watch?v=${video.videoId}`}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
										>
											Watch on YouTube
											<ExternalLink className="h-3.5 w-3.5 ml-1" />
										</a>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>

			<CardFooter className="flex justify-end">
				<Button variant="outline" onClick={() => setShowVideos(false)}>
					Hide Recommendations
				</Button>
			</CardFooter>
		</Card>
	);
}

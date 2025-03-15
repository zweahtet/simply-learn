// simply-learn/client/src/components/YouTubeRecommendations.tsx
"use client";
import useSWR from "swr";
import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoRecommendation {
	id: string;
	title: string;
	description: string;
	url: string;
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
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [topics, setTopics] = useState<string[]>([]);

	useEffect(() => {
		const fetchVideoRecommendations = async () => {
			if (!content || !level) return;

			setIsLoading(true);
			setError(null);

			try {
				// Make a request to the updated FastAPI endpoint
				const response = await fetch(
					`http://localhost:8000/video-recommendations`,
					{
						method: "POST", 
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ content: content }),
					}
				);

				if (!response.ok) {
					throw new Error(`Error: ${response.status}`);
				}

				const data = await response.json();
				if (data.success && data.videos) {
					setVideos(data.videos);
					if (data.topics) {
						setTopics(data.topics);
					}
				} else {
					setError(
						data.error || "Failed to fetch video recommendations"
					);
				}
			} catch (error) {
				console.error("Error fetching video recommendations:", error);
				setError("Failed to connect to recommendation service");
			} finally {
				setIsLoading(false);
			}
		};

		fetchVideoRecommendations();
	}, [content, level]);

	// Loading state
	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-6 w-24" />
				</div>

				<Skeleton className="h-4 w-full" />

				{[1, 2, 3].map((i) => (
					<div key={i} className="flex gap-4 border rounded-lg p-4">
						<Skeleton className="h-24 w-44" />
						<div className="space-y-2 w-full">
							<Skeleton className="h-6 w-full" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-full" />
							<div className="flex gap-2 mt-2">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-5 w-16" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
				<p className="text-red-600 mb-2">
					Unable to load video recommendations
				</p>
				<p className="text-sm text-slate-600">{error}</p>
			</div>
		);
	}

	// Empty state
	if (videos.length === 0) {
		return (
			<div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
				<p className="text-slate-600 mb-1">No relevant videos found</p>
				<p className="text-sm text-slate-500">
					Try adjusting your content or language level
				</p>
			</div>
		);
	}

	// Display video recommendations
	return (
		<div className="space-y-4">
			{topics.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-4">
					<span className="text-sm text-slate-500 mr-1">Topics:</span>
					{topics.map((topic, i) => (
						<Badge key={i} variant="secondary" className="text-xs">
							{topic}
						</Badge>
					))}
				</div>
			)}

			<div className="grid gap-4">
				{videos.map((video) => (
					<div
						key={video.id}
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
										{video.matchedTopics.map((topic, i) => (
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

								<div className="mt-3">
									<a
										href={video.url}
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
		</div>
	);
}

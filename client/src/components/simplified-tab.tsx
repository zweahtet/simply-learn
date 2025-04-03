// simply-learn/client/src/components/SimplifiedView.tsx
"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";

interface SimplifiedContentProps {
    fileId?: string | null;
}

export function SimplifiedTab({ fileId }: SimplifiedContentProps) {
	const [simplifiedChunks, setSimplifiedChunks] = useState<{
		[key: number]: string;
	}>({});
	const [streamingComplete, setStreamingComplete] = useState(false);
	const [streamingError, setStreamingError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [isConnected, setIsConnected] = useState(false);

	useEffect(() => {
		// If there's no fileId, we're not streaming
		if (!fileId) return;

		let eventSource: EventSource;

		const connectToSSE = () => {
			setIsConnected(false);

			// Connect to SSE endpoint
			eventSource = new EventSource(
				`http://localhost:8000/api/v1/files/simplification-progress/${fileId}`
			);

			// Handle connection open
			eventSource.onopen = () => {
				setIsConnected(true);
				setStreamingError(null);
			};

			// Handle incoming events
			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.status === "not_found") {
						// File not found or processing hasn't started
						return;
					}

					// Update simplified chunks state
					if (data.simplified_chunks) {
						setSimplifiedChunks(data.simplified_chunks);
					}

					// Update progress
					if (data.total_chunks && data.processed_chunks) {
						const percent = Math.round(
							(data.processed_chunks / data.total_chunks) * 100
						);
						setProgress(percent);
					}

					// Check if completed
					if (data.completed) {
						setStreamingComplete(true);
						eventSource.close();
					}

					// Check for errors
					if (data.error) {
						setStreamingError(data.error);
						eventSource.close();
					}
				} catch (e) {
					console.error("Error parsing SSE data:", e);
				}
			};

			// Handle errors
			eventSource.onerror = (e) => {
				console.error("SSE Error:", e);
				setIsConnected(false);
				setStreamingError("Connection error. Reconnecting...");

				// Close current connection
				eventSource.close();

				// Try to reconnect after a delay
				setTimeout(connectToSSE, 3000);
			};
		};

		connectToSSE();

		// Cleanup on unmount
		return () => {
			if (eventSource) {
				eventSource.close();
			}
		};
	}, [fileId]);

	// Combine chunks in correct order for display
	const getCombinedSimplifiedContent = () => {
		if (Object.keys(simplifiedChunks).length === 0) return content;

		const orderedChunks = Object.entries(simplifiedChunks)
			.sort(([a], [b]) => parseInt(a) - parseInt(b))
			.map(([_, chunk]) => chunk);

		return orderedChunks.join("\n\n");
	};

	// If we're not streaming, just show the regular content
	if (!fileId) {
		return (
			<div
				className="prose max-w-none"
				dangerouslySetInnerHTML={{
					__html: content,
				}}
			/>
		);
	}

	// If we're streaming but don't have any chunks yet
	if (fileId && Object.keys(simplifiedChunks).length === 0) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center">
						<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
						<span>Simplifying content...</span>
					</div>
					<span className="text-sm text-gray-500">
						{progress}% complete
					</span>
				</div>

				<div className="w-full bg-gray-200 rounded-full h-2 mb-6">
					<div
						className="bg-blue-600 h-2 rounded-full transition-all duration-300"
						style={{ width: `${progress}%` }}
					></div>
				</div>

				{/* Loading skeletons */}
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		);
	}

	// Show the combined content with streaming indicator if not complete
	return (
		<div>
			{!streamingComplete && (
				<div className="flex items-center justify-between mb-4 p-2 bg-blue-50 rounded-md">
					<div className="flex items-center">
						<RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-600" />
						<span className="text-blue-800">
							Processing content...
						</span>
					</div>
					<span className="text-sm font-medium">
						{progress}% complete
					</span>
				</div>
			)}

			{streamingError && (
				<div className="p-3 mb-4 bg-red-50 text-red-700 rounded-md border border-red-200">
					{streamingError}
				</div>
			)}

			<div
				className="prose max-w-none"
				dangerouslySetInnerHTML={{
					__html: getCombinedSimplifiedContent(),
				}}
			/>
		</div>
	);
}
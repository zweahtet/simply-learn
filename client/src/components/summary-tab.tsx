// simply-learn/client/src/components/summary-tab.tsx
"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DocumentSummary } from "@/types";
import useSWR from "swr";
import Markdown from "react-markdown";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
	summarizeFile,
	getSummary,
	trackTaskStatus,
} from "@/lib/backend/files";

interface SummaryTabProps {
	fileId: string;
}

/**
 * SummaryTab component fetches and displays the summary of a document.
 * @param fileId - The ID of the file to fetch the summary for.
 */
export function SummaryTab({ fileId }: SummaryTabProps) {
	const [isGenerating, setIsGenerating] = useState(false);
	const [progress, setProgress] = useState(0);
	const [stage, setStage] = useState("");
	const [taskId, setTaskId] = useState<string | null>(null);
	const [summaryError, setSummaryError] = useState<string | null>(null);

	const { data, isLoading, error, mutate } = useSWR(fileId, getSummary, {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		revalidateIfStale: false,
	});

	// Start summarization process if needed
	useEffect(() => {
		if (!isLoading && !data && !isGenerating && !summaryError) {
			startSummarization();
		}
	}, [isLoading, data, isGenerating, summaryError]);

	// Monitor task progress using SSE
	useEffect(() => {
		let closeConnection: () => void;

		if (taskId) {
			closeConnection = trackTaskStatus(taskId, (statusData) => {
				if (statusData.progress) {
					setStage(statusData.progress.stage);
					setProgress(statusData.progress.progress || 0);
				}

				if (statusData.status === "SUCCESS") {
					setIsGenerating(false);
					// Refresh summary data
					mutate();
					toast.success("Summary generated successfully");
				}

				if (statusData.error || statusData.status === "FAILURE") {
					setIsGenerating(false);
					setSummaryError(
						"Failed to generate summary. Please try again."
					);
					toast.error("Failed to generate summary");
				}
			});
		}

		return () => {
			if (closeConnection) closeConnection();
		};
	}, [taskId]);

	const startSummarization = async () => {
		setIsGenerating(true);
		setSummaryError(null);

		try {
			const response = await summarizeFile(fileId);
			setTaskId(response.task_id);
		} catch (err) {
			console.error("Error starting summarization:", err);
			setIsGenerating(false);
			setSummaryError(
				"Failed to start summary generation. Please try again."
			);
			toast.error("Failed to start summary generation");
		}
	};

	// show loading state while fetching existing summary
	if (isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-6 w-1/2" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
			</div>
		);
	}

	// Show summary generation progress
	if (isGenerating) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-muted-foreground">{stage}</p>
				<Progress value={progress} className="w-full" />
			</div>
		);
	}

	// Show error with retry option
	if (summaryError || error) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-red-500">
					{summaryError || "Failed to load summary"}
				</p>
				<Button onClick={startSummarization} variant="outline">
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<Markdown>{data?.summary || ""}</Markdown>
		</div>
	);
}
// simply-learn/client/src/components/summary-tab.tsx
"use client";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DocumentSummary } from "@/types";
import useSWR from "swr";
import Markdown from "react-markdown";

interface SummaryTabProps {
    fileId?: string | null;
}

/**
 * SummaryTab component fetches and displays the summary of a document.
 * @param fileId - The ID of the file to fetch the summary for.
 */
export function SummaryTab({ fileId }: SummaryTabProps) {
    const { data, isLoading, error } = useSWR(
        fileId ? `http://localhost:8000/api/v1/files/${fileId}/summary` : null,
        (url) => fetch(url).then((res) => res.json()),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
        }
    )

    if (error) {
        toast.error("Failed to load summary: " + error || "Unknown error");
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Markdown>
                {data.summary}
            </Markdown>
            
        </div>
    )
}
// client/src/hooks/useSimplifierProgress.ts
"use client";
import { useState, useEffect } from 'react';

interface SimplifiedChunk {
    [chunkIndex: number]: string;
}

interface SimplificationProgress {
    total_chunks: number;
    processed_chunks: number;
    simplified_chunks: SimplifiedChunk;
    completed: boolean;
    error: string | null;
}

export function useSimplificationProgress(fileId: string | null) {
    const [progress, setProgress] = useState<SimplificationProgress | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!fileId) return;

        let eventSource: EventSource;

        const connectToSSE = () => {
            setLoading(true);

            // Connect to SSE endpoint
            eventSource = new EventSource(`http://localhost:8000/api/v1/files/simplification-progress/${fileId}`);

            // Handle incoming events
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.status === 'not_found') {
                    // File not found or processing hasn't started
                    return;
                }

                setProgress(data);

                if (data.completed || data.error) {
                    // Simplification finished or error occurred
                    eventSource.close();
                    setLoading(false);
                }
            };

            // Handle connection open
            eventSource.onopen = () => {
                setError(null);
            };

            // Handle errors
            eventSource.onerror = (e) => {
                console.error('SSE Error:', e);
                setError('Connection error. Reconnecting...');

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

    return { progress, loading, error };
}
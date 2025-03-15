// simply-learn/client/src/components/ContentDisplay.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface LimitedActionButtonProps {
    actionName: string;
    onClick: () => Promise<void>;
}

interface RateLimitInfo {
    total: number;
    remaining: number;
    used: number;
    resetIn: number;
}

export default function LimitedActionButton({ actionName, onClick }: LimitedActionButtonProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [limitInfo, setLimitInfo] = useState<RateLimitInfo | null>(null);
	const [isLimited, setIsLimited] = useState(false);

	// Fetch rate limit info on component mount
	useEffect(() => {
		async function fetchLimitInfo() {
			try {
				const response = await fetch("/api/limits");
				if (response.ok) {
					const data = await response.json();
					setLimitInfo(data.limits);
					setIsLimited(data.limits.remaining <= 0);
				}
			} catch (error) {
				console.error("Error fetching rate limit info:", error);
			}
		}

		fetchLimitInfo();

		// Refresh limit info every minute
		const interval = setInterval(fetchLimitInfo, 60000);
		return () => clearInterval(interval);
	}, []);

	const handleClick = async () => {
		if (isLimited || isLoading) return;

		setIsLoading(true);

		try {
			// Perform the action
			await onClick();

			// Refresh limit info
			const response = await fetch("/api/limits");
			if (response.ok) {
				const data = await response.json();
				setLimitInfo(data.limits);
				setIsLimited(data.limits.remaining <= 0);
			}
		} catch (error) {
			console.error("Error performing action:", error);
		} finally {
			setIsLoading(false);
		}
	};

	// Format time until reset
	const formatTimeRemaining = () => {
		if (!limitInfo?.resetIn) return "";

		const hours = Math.floor(limitInfo.resetIn / 3600);
		const minutes = Math.floor((limitInfo.resetIn % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	};

	return (
		<div className="flex flex-col">
			<button
				onClick={handleClick}
				disabled={isLimited || isLoading}
				className={`px-4 py-2 rounded-md font-medium transition-colors ${
					isLimited
						? "bg-gray-300 text-gray-500 cursor-not-allowed"
						: "bg-blue-500 hover:bg-blue-600 text-white"
				}`}
			>
				{isLoading ? "Processing..." : actionName}
			</button>

			{limitInfo && (
				<div className="mt-2 text-sm">
					{isLimited ? (
						<p className="text-red-500">
							Daily limit reached. Resets in{" "}
							{formatTimeRemaining()}
						</p>
					) : (
						<div className="text-gray-600">
							<div className="flex justify-between">
								<span>
									{limitInfo.remaining} of {limitInfo.total}{" "}
									actions remaining
								</span>
								<span>Resets in {formatTimeRemaining()}</span>
							</div>
							<div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
								<div
									className="h-full bg-blue-500 rounded-full"
									style={{
										width: `${
											(limitInfo.used / limitInfo.total) *
											100
										}%`,
									}}
								/>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

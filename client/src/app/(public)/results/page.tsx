// simply-learn/client/src/app/(public)/results/page.tsx
"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssessmentResults } from "@/components/Assessment";
import { AssessmentResultsSummary } from "@/types";

export default function ResultsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const level = searchParams.get("level") || "B1";

	const [results, setResults] = useState<AssessmentResultsSummary | null>(null);

	useEffect(() => {
		// Retrieve detailed results from sessionStorage
		const storedResults = sessionStorage.getItem("assessmentResults");
		if (storedResults) {
			setResults(JSON.parse(storedResults));
		} else {
			// If no results found, redirect back to assessment
			router.push("/assessment");
		}
	}, [router]);

	if (!results) {
		return <div>Loading...</div>;
	}

	return (
		<div className="container mx-auto py-8 px-4">
			<AssessmentResults
				results={results}
				onContinue={(selectedLevel) => {
					// Update level if changed
					if (selectedLevel !== results.languageLevel) {
						const updatedResults = {
							...results,
							languageLevel: selectedLevel,
						};
						sessionStorage.setItem(
							"assessmentResults",
							JSON.stringify(updatedResults)
						);
					}
					router.push("/register");
				}}
			/>
		</div>
	);
}

// simply-learn/client/src/app/(public)/assessment/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { CognitiveAssessment } from "@/components/Assessment";

export default function AssessmentPage() {
	const router = useRouter();

	const handleAssessmentComplete = (results: any) => {
		// Store detailed results in sessionStorage
		sessionStorage.setItem("assessmentResults", JSON.stringify(results));

		// Navigate to results page with basic info in URL
		router.push(`/results?level=${results.languageLevel}`);
	};

	return (
		<div className="container mx-auto py-8 px-4">
			<CognitiveAssessment
				onComplete={handleAssessmentComplete}
				onCancel={() => {
					// Store default results
					const defaultResults = {
						languageLevel: "B1",
						cognitiveProfile: {
							memory: 5,
							attention: 5,
							language: 5,
							visualSpatial: 5,
							executive: 5,
						},
					};
					sessionStorage.setItem(
						"assessmentResults",
						JSON.stringify(defaultResults)
					);
					router.push(`/results?level=B1`);
				}}
			/>
		</div>
	);
}

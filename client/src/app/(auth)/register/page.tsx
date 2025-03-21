// app/(auth)/register/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Register } from "@/components/Register";
import { CognitiveProfile } from "@/types";

export default function RegisterPage() {
	const router = useRouter();
	const [assessmentResults, setAssessmentResults] = useState<{
		languageLevel: string;
		cognitiveProfile: CognitiveProfile;
	} | null>(null);

	useEffect(() => {
		// Retrieve assessment results from sessionStorage
		const storedResults = sessionStorage.getItem("assessmentResults");
		if (storedResults) {
			setAssessmentResults(JSON.parse(storedResults));
		} else {
			// If no results, redirect to assessment
			router.push("/assessment");
		}
	}, [router]);

	if (!assessmentResults) {
		return <div>Loading...</div>;
	}

	return (
		<div className="container mx-auto py-8 px-4">
			<Register
				onLoginClick={() => router.push("/login")}
				assessmentResults={assessmentResults}
			/>
		</div>
	);
}

// simply-learn/client/src/app/page.tsx
"use client";

import { useState } from "react";
import { ContentUploader } from "@/components/ContentUploader";
import { ContentDisplay } from "@/components/ContentDisplay";
import { ExerciseGenerator } from "@/components/ExerciseGenerator";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Brain, FileText, Lightbulb, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	CognitiveAssessment,
	AssessmentResults,
} from "@/components/Assessment";

// Extended to include cognitive assessment
// Assessment-first flow states
type ViewState =
	| "welcome"
	| "cognitive"
	| "results"
	| "upload"
	| "content"
	| "exercises";

interface CognitiveProfile {
	memory: number;
	attention: number;
	language: number;
	visualSpatial: number;
	executive: number;
}

interface AssessmentResultsSummary {
	languageLevel: string;
	cognitiveProfile: CognitiveProfile;
	overallScore: number;
}

export default function Home() {
	const [view, setView] = useState<ViewState>("welcome");
	const [content, setContent] = useState("");
	const [originalContent, setOriginalContent] = useState("");
	const [learnerLevel, setLearnerLevel] = useState("");
	const [exercises, setExercises] = useState("");
	const [assessmentResults, setAssessmentResults] =
		useState<AssessmentResultsSummary | null>(null);
	const [cognitiveProfile, setCognitiveProfile] =
		useState<CognitiveProfile | null>(null);

	const handleStartAssessment = () => {
		setView("cognitive");
	};

	const handleAssessmentComplete = (results: AssessmentResultsSummary) => {
		setAssessmentResults(results);
		setCognitiveProfile(results.cognitiveProfile);
		setLearnerLevel(results.languageLevel);
		setView("results");
	};

	const handleAssessmentCancel = () => {
		// Skip assessment and use default values
		setLearnerLevel("B1");
		setCognitiveProfile({
			memory: 5,
			attention: 5,
			language: 5,
			visualSpatial: 5,
			executive: 5,
		});
		setView("upload");
	};

	const handleContinueToUpload = () => {
		setView("upload");
	};

	const handleContentUpload = (uploadedContent: string) => {
		setOriginalContent(uploadedContent);
		adaptContent(uploadedContent);
	};

	const adaptContent = async (uploadedContent: string) => {
		try {
			// Use the enhanced adaptation API with cognitive profile
			const response = await fetch("/api/simplify-content", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: uploadedContent,
					level: learnerLevel,
					cognitiveProfile,
				}),
			});

			const data = await response.json();

			if (data.success) {
				setContent(data.adaptedContent);
				setView("content");
			} else {
				alert(
					"Error adapting content: " + (data.error || "Unknown error")
				);
			}
		} catch (error) {
			console.error("Error:", error);
			alert("Error connecting to server");
		}
	};

	const handleGenerateExercises = async () => {

		try {
			const response = await fetch("/api/generate-exercises", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: originalContent,
					level: learnerLevel,
					cognitiveProfile,
				}),
			});

			const data = await response.json();

			if (data.success) {
				setExercises(data.exercises);
				setView("exercises");
			} else {
				alert(
					"Error generating exercises: " +
						(data.error || "Unknown error")
				);
			}
		} catch (error) {
			console.error("Error:", error);
			alert("Error connecting to server");
		}
	};

	const handleRestart = () => {
		// Reset all state variables
		setView("upload");
		setContent("");
		setOriginalContent("");
		setLearnerLevel("");
		setExercises("");
	};

	return (
		<main className="min-h-screen bg-slate-50 py-12">
			<div className="container px-4 mx-auto">
				<header className="text-center mb-12">
					<div className="inline-flex items-center gap-2 mb-4">
						<h1 className="text-4xl font-bold text-slate-900">
							EquiLearn
						</h1>
						<Badge className="text-xs" variant="outline">
							PROTOTYPE
						</Badge>
					</div>
					<p className="text-slate-600 text-xl max-w-2xl mx-auto">
						AI-Powered Educational Content Adaptation for ESL
						Learners
					</p>

					{/* Progress indicator - revised for assessment-first flow */}
					{view !== "welcome" && (
						<div className="mt-8">
							<div className="flex justify-center">
								<div className="flex items-center">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											view === "cognitive"
												? "bg-blue-600 text-white"
												: "bg-blue-100 text-blue-600"
										}`}
									>
										1
									</div>
									<div
										className={`w-16 h-1 ${
											view !== "cognitive"
												? "bg-blue-600"
												: "bg-gray-200"
										}`}
									></div>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											view === "results"
												? "bg-blue-600 text-white"
												: view === "cognitive"
												? "bg-gray-200 text-gray-500"
												: "bg-blue-100 text-blue-600"
										}`}
									>
										2
									</div>
									<div
										className={`w-16 h-1 ${
											view === "upload" ||
											view === "content" ||
											view === "exercises"
												? "bg-blue-600"
												: "bg-gray-200"
										}`}
									></div>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											view === "upload"
												? "bg-blue-600 text-white"
												: view === "cognitive" ||
												  view === "results"
												? "bg-gray-200 text-gray-500"
												: "bg-blue-100 text-blue-600"
										}`}
									>
										3
									</div>
									<div
										className={`w-16 h-1 ${
											view === "content" ||
											view === "exercises"
												? "bg-blue-600"
												: "bg-gray-200"
										}`}
									></div>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											view === "content"
												? "bg-blue-600 text-white"
												: view === "cognitive" ||
												  view === "results" ||
												  view === "upload"
												? "bg-gray-200 text-gray-500"
												: "bg-blue-100 text-blue-600"
										}`}
									>
										4
									</div>
									<div
										className={`w-16 h-1 ${
											view === "exercises"
												? "bg-blue-600"
												: "bg-gray-200"
										}`}
									></div>
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center ${
											view === "exercises"
												? "bg-blue-600 text-white"
												: "bg-gray-200 text-gray-500"
										}`}
									>
										5
									</div>
								</div>
							</div>

							{/* Step labels - revised for assessment-first flow */}
							<div className="flex justify-center mt-2">
								<div className="grid grid-cols-5 gap-4 text-xs text-gray-500 w-full max-w-2xl">
									<div className="text-center">
										Assessment
									</div>
									<div className="text-center">Profile</div>
									<div className="text-center">Upload</div>
									<div className="text-center">Content</div>
									<div className="text-center">Practice</div>
								</div>
							</div>
						</div>
					)}
				</header>

				{/* Loading overlay */}
				{/* {isLoading && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<div className="bg-white p-6 rounded-lg shadow-lg text-center">
							<div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
							<p className="text-slate-900 font-medium">
								Processing...
							</p>
							<p className="text-slate-600 text-sm mt-1">
								This may take a few moments
							</p>
						</div>
					</div>
				)} */}

				{/* Welcome screen */}
				{view === "welcome" && (
					<Card className="w-full max-w-4xl mx-auto">
						<CardHeader className="text-center">
							<CardTitle className="text-2xl">
								Welcome to EquiLearn
							</CardTitle>
							<CardDescription>
								Personalized education adapted to your language
								level and cognitive style
							</CardDescription>
						</CardHeader>

						<CardContent>
							<div className="grid md:grid-cols-2 gap-6 py-4">
								<div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-lg">
									<Brain className="h-12 w-12 text-blue-600 mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Cognitive Assessment
									</h3>
									<p className="text-sm text-slate-600">
										A brief assessment to understand your
										learning style and cognitive preferences
									</p>
								</div>

								<div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-lg">
									<GraduationCap className="h-12 w-12 text-blue-600 mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Language Proficiency
									</h3>
									<p className="text-sm text-slate-600">
										We'll determine your English level to
										provide content that matches your
										abilities
									</p>
								</div>

								<div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-lg">
									<FileText className="h-12 w-12 text-blue-600 mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Content Adaptation
									</h3>
									<p className="text-sm text-slate-600">
										Educational content transformed to match
										your unique learning profile
									</p>
								</div>

								<div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-lg">
									<Lightbulb className="h-12 w-12 text-blue-600 mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Video Recommendations
									</h3>
									<p className="text-sm text-slate-600">
										AI-powered YouTube video suggestions to
										reinforce your learning
									</p>
								</div>
							</div>
						</CardContent>

						<CardFooter className="flex justify-between">
							<Button
								variant="outline"
								onClick={handleAssessmentCancel}
							>
								Skip Assessment
							</Button>

							<Button onClick={handleStartAssessment} size="lg">
								Start Assessment
							</Button>
						</CardFooter>
					</Card>
				)}

				{view === "cognitive" && (
					<CognitiveAssessment
						onComplete={handleAssessmentComplete}
						onCancel={handleAssessmentCancel}
					/>
				)}

				{view === "results" && assessmentResults && (
					<AssessmentResults
						results={assessmentResults}
						onContinue={handleContinueToUpload}
					/>
				)}

				{view === "upload" && (
					<ContentUploader onUpload={handleContentUpload} />
				)}

				{view === "content" && (
					<div className="space-y-6">
						<ContentDisplay
							content={content}
							originalContent={originalContent}
							level={learnerLevel}
							onGenerateExercises={handleGenerateExercises}
						/>
					</div>
				)}

				{view === "exercises" && (
					<ExerciseGenerator
						exercises={exercises}
						level={learnerLevel}
						onBack={() => setView("content")}
						onRestart={handleRestart}
					/>
				)}

				<footer className="mt-16 text-center text-slate-500 text-sm">
					<p>EquiLearn | AI for Good Hackathon 2025</p>
					<p className="mt-1">
						Supporting SDG 4 (Quality Education) & SDG 10 (Reduced
						Inequalities)
					</p>
				</footer>
			</div>
		</main>
	);
}

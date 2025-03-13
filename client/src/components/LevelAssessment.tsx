// src/components/LevelAssessment.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface LevelAssessmentProps {
	onAssess: (level: string) => void;
}

export function LevelAssessment({ onAssess }: LevelAssessmentProps) {
	const [level, setLevel] = useState("B1");
	const [customText, setCustomText] = useState("");
	const [isAssessing, setIsAssessing] = useState(false);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("manual");

	const handleManualSelect = () => {
		onAssess(level);
	};

	const handleAutoAssess = async () => {
		if (!customText.trim()) {
			setError("Please enter some text for assessment");
			return;
		}

		setIsAssessing(true);
		setError("");

		try {
			const response = await fetch("/api/assess-level", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ response: customText }),
			});

			const data = await response.json();

			if (data.success) {
				const detectedLevel = data.level;
				setLevel(detectedLevel);

				// Auto-proceed after 1 second
				setTimeout(() => onAssess(detectedLevel), 1000);
			} else {
				setError(data.error || "Error assessing level");
			}
		} catch (error) {
			console.error("Error:", error);
			setError("Error connecting to server");
		} finally {
			setIsAssessing(false);
		}
	};

	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle>English Proficiency Level</CardTitle>
				<CardDescription>
					Select your English level or let us assess it automatically.
				</CardDescription>
			</CardHeader>

			<CardContent>
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Tabs defaultValue="manual" onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="manual">
							Manual Selection
						</TabsTrigger>
						<TabsTrigger value="auto">Auto Assessment</TabsTrigger>
					</TabsList>

					<TabsContent value="manual" className="space-y-4">
						<div className="grid grid-cols-3 gap-3 mt-4">
							{["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
								<Button
									key={l}
									variant={
										level === l ? "default" : "outline"
									}
									className="justify-between"
									onClick={() => setLevel(l)}
								>
									{l}{" "}
									<span className="text-xs opacity-70">
										{getLevelDescription(l)}
									</span>
								</Button>
							))}
						</div>

						<div className="text-center mt-6">
							<Button size="lg" onClick={handleManualSelect}>
								Continue with {level}
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="auto" className="space-y-4">
						<div className="space-y-2">
							<label
								htmlFor="assessment-text"
								className="text-sm font-medium"
							>
								Write a few sentences in English, and we'll
								determine your level:
							</label>
							<Textarea
								id="assessment-text"
								value={customText}
								onChange={(e) => setCustomText(e.target.value)}
								placeholder="Write at least 3-4 sentences in English..."
								className="min-h-[150px]"
							/>
						</div>

						<div className="text-center mt-4">
							<Button
								size="lg"
								onClick={handleAutoAssess}
								disabled={isAssessing}
							>
								{isAssessing
									? "Assessing..."
									: "Assess My Level"}
							</Button>
						</div>

						{level && activeTab === "auto" && (
							<div className="text-center mt-2">
								<p>
									Detected level:{" "}
									<Badge variant="outline">{level}</Badge>
								</p>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function getLevelDescription(level: string) {
	const descriptions: Record<string, string> = {
		A1: "Beginner",
		A2: "Elementary",
		B1: "Intermediate",
		B2: "Upper Intermediate",
		C1: "Advanced",
		C2: "Proficient",
	};

	return descriptions[level] || "";
}

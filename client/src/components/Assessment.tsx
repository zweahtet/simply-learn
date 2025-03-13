// src/components/Assessment.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, ChevronRight, Clock, Brain } from "lucide-react";

// Define assessment sections
interface AssessmentQuestion {
	id: string;
	type: "choice" | "text" | "memory" | "visuospatial" | "sequencing";
	question: string;
	choices?: string[];
	correctAnswer?: string;
	instructions?: string;
	points: number;
	timerSeconds?: number; // Add timer property to questions
}

interface AssessmentSection {
	id: string;
	title: string;
	description: string;
	questions: AssessmentQuestion[];
}

interface AssessmentResultsSummary {
	languageLevel: string;
	cognitiveProfile: {
		memory: number;
		attention: number;
		language: number;
		visualSpatial: number;
		executive: number;
	};
	overallScore: number;
}

interface CognitiveAssessmentProps {
	onComplete: (results: AssessmentResultsSummary) => void;
	onCancel: () => void;
}

export function CognitiveAssessment({
	onComplete,
	onCancel,
}: CognitiveAssessmentProps) {
	const [currentSection, setCurrentSection] = useState(0);
	const [currentQuestion, setCurrentQuestion] = useState(0);
	const [answers, setAnswers] = useState<Record<string, any>>({});
	const [memoryItems, setMemoryItems] = useState<string[]>([]);
	const [showMemoryItems, setShowMemoryItems] = useState(false);
	const [countdownValue, setCountdownValue] = useState(0);
	const [isCountingDown, setIsCountingDown] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [activeTimerId, setActiveTimerId] = useState<NodeJS.Timeout | null>(
		null
	);

	// Assessment sections
	const sections: AssessmentSection[] = [
		{
			id: "introduction",
			title: "Assessment Introduction",
			description:
				"This brief assessment will help us understand your language proficiency and cognitive preferences. It will take approximately 5 minutes to complete.",
			questions: [
				{
					id: "intro",
					type: "choice",
					question: "What is your native language?",
					choices: [
						"English",
						"Spanish",
						"Chinese",
						"Arabic",
						"French",
						"Other",
					],
					points: 0,
				},
			],
		},
		{
			id: "attention",
			title: "Attention & Concentration",
			description:
				"These exercises assess your ability to maintain focus.",
			questions: [
				{
					id: "digit_sequence",
					type: "text",
					question:
						"Please type these digits in the exact order: 2 1 8 5 4",
					correctAnswer: "21854",
					points: 1,
				},
				{
					id: "reverse_digits",
					type: "text",
					question: "Now type these digits in reverse order: 7 4 2",
					correctAnswer: "247",
					points: 1,
				},
				{
					id: "letter_task",
					type: "text",
					question:
						"Tap/press whenever you see the letter A: T A B C D A F G H A I",
					instructions:
						'Type "A" each time you would tap (e.g., "AAA" for 3 A\'s)',
					correctAnswer: "AAA",
					points: 1,
				},
			],
		},
		{
			id: "language",
			title: "Language Assessment",
			description:
				"These exercises assess your language comprehension and production.",
			questions: [
				{
					id: "sentence_repetition",
					type: "text",
					question:
						"Please retype the following sentence exactly: The cat always hid under the couch when dogs were in the room.",
					correctAnswer:
						"The cat always hid under the couch when dogs were in the room.",
					points: 2,
				},
				{
					id: "fluency",
					type: "text",
					question:
						"List as many words as you can think of that start with the letter F in 30 seconds.",
					instructions: "Separate words with spaces or commas",
					points: 1,
					timerSeconds: 30, // Add timer property for fluency question
				},
				{
					id: "comprehension",
					type: "choice",
					question:
						'Choose the sentence that has the same meaning as: "She wasn\'t the only one who failed the test."',
					choices: [
						"She was the only one who passed the test.",
						"Others also failed the test.",
						"She was the only one who failed the test.",
						"Nobody passed the test.",
					],
					correctAnswer: "Others also failed the test.",
					points: 1,
				},
			],
		},
		{
			id: "memory",
			title: "Memory Assessment",
			description:
				"This exercise tests your ability to remember information over a short period.",
			questions: [
				{
					id: "memory_registration",
					type: "memory",
					question:
						"You will be shown 5 words for 10 seconds. Try to memorize them as you will be asked to recall them later.",
					instructions: "Press the button to see the words.",
					points: 5,
					timerSeconds: 10, // Add timer property for memory registration
				},
				{
					id: "memory_distraction",
					type: "choice",
					question: "What do you enjoy most about learning?",
					choices: [
						"Discovering new information",
						"Mastering difficult concepts",
						"Applying knowledge to real problems",
						"Discussing ideas with others",
					],
					points: 0,
				},
				{
					id: "memory_recall",
					type: "text",
					question:
						"Please recall as many of the 5 words shown earlier as you can.",
					instructions:
						"Type the words separated by spaces or commas",
					points: 5,
				},
			],
		},
		{
			id: "executive",
			title: "Executive Function",
			description:
				"These exercises assess your ability to plan, organize, and solve problems.",
			questions: [
				{
					id: "similarities",
					type: "choice",
					question: "How are a boat and a car similar?",
					choices: [
						"Both have engines",
						"Both have wheels",
						"Both are methods of transportation",
						"Both float on water",
					],
					correctAnswer: "Both are methods of transportation",
					points: 1,
				},
				{
					id: "calculation",
					type: "text",
					question:
						"Subtract 7 from 100, then subtract 7 from the result, and so on for a total of 5 subtractions. Write all 5 numbers.",
					instructions:
						"Separate numbers with spaces or commas (e.g., 93, 86, ...)",
					correctAnswer: "93 86 79 72 65",
					points: 3,
				},
				{
					id: "sequences",
					type: "sequencing",
					question:
						"What comes next in this sequence: 2, 4, 8, 16, ?",
					choices: ["24", "30", "32", "64"],
					correctAnswer: "32",
					points: 1,
				},
			],
		},
	];

	const memoryWords = ["apple", "table", "river", "pencil", "butterfly"];

	const currentSectionData = sections[currentSection];
	const currentQuestionData = currentSectionData?.questions[currentQuestion];
	const totalSections = sections.length;
	const totalQuestionsInSection = currentSectionData?.questions.length || 0;

	const progressPercent = (currentSection / totalSections) * 100;

	// Start timer function for any timed question
	const startTimer = (seconds: number, callbackFn?: () => void) => {
		// Clear any existing timer
		if (activeTimerId) {
			clearInterval(activeTimerId);
		}

		setCountdownValue(seconds);
		setIsCountingDown(true);

		const timerId = setInterval(() => {
			setCountdownValue((prev) => {
				if (prev <= 1) {
					clearInterval(timerId);
					setIsCountingDown(false);
					if (callbackFn) callbackFn();

					// Create a flag to indicate timer has expired
					const questionKey = `${currentSectionData.id}_${currentQuestionData.id}`;
					setAnswers((prev) => ({
						...prev,
						[`${questionKey}_timerExpired`]: true,
					}));

					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		setActiveTimerId(timerId);
		return timerId;
	};

	// Stop any active timer
	const stopTimer = () => {
		if (activeTimerId) {
			clearInterval(activeTimerId);
			setActiveTimerId(null);
			setIsCountingDown(false);
		}
	};

	// Clean up timer on component unmount
	useEffect(() => {
		return () => {
			if (activeTimerId) {
				clearInterval(activeTimerId);
			}
		};
	}, [activeTimerId]);

	// Handle answer changes
	const handleAnswerChange = (value: string) => {
		setAnswers({
			...answers,
			[`${currentSectionData.id}_${currentQuestionData.id}`]: value,
		});
		setErrorMessage("");
	};

	// Start memory task
	const startMemoryTask = () => {
		// Set a flag to prevent showing the memory words more than once
		const memoryShownKey = `${currentSectionData.id}_${currentQuestionData.id}_memoryShown`;
		setAnswers((prev) => ({
			...prev,
			[memoryShownKey]: true,
		}));

		setMemoryItems(memoryWords);
		setShowMemoryItems(true);

		// Use the generic timer function
		startTimer(10, () => {
			setShowMemoryItems(false);
		});
	};

	// Handle next question
	const handleNextQuestion = () => {
		// Check if answer is provided
		const currentAnswerKey = `${currentSectionData.id}_${currentQuestionData.id}`;
		const timerExpiredKey = `${currentAnswerKey}_timerExpired`;

		// Skip validation for timed questions that have expired timers
		const isTimedQuestionCompleted =
			answers[timerExpiredKey] ||
			(currentQuestionData.timerSeconds &&
				countdownValue === 0 &&
				!isCountingDown);

		// For non-timed questions or timed questions with active timers, require answers for point-valued questions
		if (
			!isTimedQuestionCompleted &&
			!answers[currentAnswerKey] &&
			currentQuestionData.type !== "memory" &&
			currentQuestionData.points > 0
		) {
			setErrorMessage("Please provide an answer before continuing.");
			return;
		}

		// Stop any active timer before moving to next question
		stopTimer();

		// Clean up the timer expired flag if present
		if (answers[timerExpiredKey]) {
			setAnswers((prev) => {
				const newAnswers = { ...prev };
				delete newAnswers[timerExpiredKey];
				return newAnswers;
			});
		}

		// Move to next question or section
		setErrorMessage("");
		if (currentQuestion < totalQuestionsInSection - 1) {
			setCurrentQuestion(currentQuestion + 1);

			// Check if the next question has a timer
			const nextQuestion =
				currentSectionData.questions[currentQuestion + 1];
			if (
				nextQuestion.timerSeconds &&
				nextQuestion.id !== "memory_registration"
			) {
				// Start timer for the next question (if not memory registration which has a manual start)
				startTimer(nextQuestion.timerSeconds);
			}
		} else {
			if (currentSection < totalSections - 1) {
				setCurrentSection(currentSection + 1);
				setCurrentQuestion(0);

				// Check if the first question of the next section has a timer
				const nextSection = sections[currentSection + 1];
				const nextFirstQuestion = nextSection.questions[0];
				if (
					nextFirstQuestion.timerSeconds &&
					nextFirstQuestion.id !== "memory_registration"
				) {
					// Start timer for the next question (if not memory registration which has a manual start)
					startTimer(nextFirstQuestion.timerSeconds);
				}
			} else {
				// Assessment complete
				const results = calculateResults();
				onComplete(results);
			}
		}
	};

	// Calculate assessment results
	const calculateResults = (): AssessmentResultsSummary => {
		// Score individual sections
		let memoryScore = 0;
		let attentionScore = 0;
		let languageScore = 0;
		let executiveScore = 0;
		let visualSpatialScore = 0;
		let totalPoints = 0;
		let earnedPoints = 0;

		sections.forEach((section) => {
			section.questions.forEach((question) => {
				const answerKey = `${section.id}_${question.id}`;
				const userAnswer = answers[answerKey] || "";
				totalPoints += question.points;

				let isCorrect = false;

				// Check answers against correct answers where applicable
				if (question.correctAnswer) {
					if (question.type === "choice") {
						isCorrect = userAnswer === question.correctAnswer;
					} else {
						// For text answers, do case-insensitive, whitespace-tolerant comparison
						const normalizedUserAnswer = userAnswer
							.toLowerCase()
							.trim()
							.replace(/\s+/g, " ");
						const normalizedCorrectAnswer = question.correctAnswer
							.toLowerCase()
							.trim()
							.replace(/\s+/g, " ");
						isCorrect =
							normalizedUserAnswer === normalizedCorrectAnswer;
					}

					if (isCorrect) {
						earnedPoints += question.points;
					}
				} else if (question.id === "memory_recall") {
					// Score memory recall - each word is worth 1 point
					const recalledWords = userAnswer
						.toLowerCase()
						.split(/[\s,]+/)
						.filter(Boolean);
					const correctWords = memoryWords.filter((word) =>
						recalledWords.includes(word.toLowerCase())
					);

					earnedPoints += correctWords.length;
				} else if (question.id === "fluency") {
					// Score fluency - give points based on number of valid F words
					const fWords = userAnswer
						.toLowerCase()
						.split(/[\s,]+/)
						.filter(
							(word: string) =>
								word.startsWith("f") && word.length > 1
						);

					const uniqueFWords = new Set(fWords);
					earnedPoints += Math.min(
						uniqueFWords.size,
						question.points
					);
				}

				// Categorize scores by cognitive domain
				if (section.id === "memory") {
					if (question.id === "memory_recall") {
						const recalledWords = userAnswer
							.toLowerCase()
							.split(/[\s,]+/)
							.filter(Boolean);
						const correctWords = memoryWords.filter((word) =>
							recalledWords.includes(word.toLowerCase())
						);
						memoryScore += correctWords.length;
					}
				} else if (section.id === "attention") {
					if (isCorrect) {
						attentionScore += question.points;
					}
				} else if (section.id === "language") {
					if (question.id === "fluency") {
						const fWords = userAnswer
							.toLowerCase()
							.split(/[\s,]+/)
							.filter(
								(word: string) =>
									word.startsWith("f") && word.length > 1
							);
						const uniqueFWords = new Set(fWords);
						languageScore += Math.min(
							uniqueFWords.size,
							question.points
						);
					} else if (isCorrect) {
						languageScore += question.points;
					}
				} else if (section.id === "executive") {
					if (isCorrect) {
						executiveScore += question.points;
					}
				}
			});
		});

		// Calculate overall score percentage
		const overallScore = Math.round((earnedPoints / totalPoints) * 100);

		// Map scores to cognitive profile (0-10 scale)
		const maxMemoryScore = 5;
		const maxAttentionScore = 3;
		const maxLanguageScore = 4;
		const maxExecutiveScore = 5;

		// Determine language level based on scores
		// Use a weighted approach favoring language and attention scores
		const languageWeight = 0.5;
		const attentionWeight = 0.2;
		const memoryWeight = 0.15;
		const executiveWeight = 0.15;

		const weightedScore =
			(languageScore / maxLanguageScore) * languageWeight +
			(attentionScore / maxAttentionScore) * attentionWeight +
			(memoryScore / maxMemoryScore) * memoryWeight +
			(executiveScore / maxExecutiveScore) * executiveWeight;

		// Map weighted score to CEFR levels
		let languageLevel = "B1"; // Default to intermediate

		if (weightedScore < 0.35) {
			languageLevel = "A1";
		} else if (weightedScore < 0.5) {
			languageLevel = "A2";
		} else if (weightedScore < 0.65) {
			languageLevel = "B1";
		} else if (weightedScore < 0.8) {
			languageLevel = "B2";
		} else if (weightedScore < 0.9) {
			languageLevel = "C1";
		} else {
			languageLevel = "C2";
		}

		return {
			languageLevel,
			cognitiveProfile: {
				memory: Math.round((memoryScore / maxMemoryScore) * 10),
				attention: Math.round(
					(attentionScore / maxAttentionScore) * 10
				),
				language: Math.round((languageScore / maxLanguageScore) * 10),
				visualSpatial: visualSpatialScore,
				executive: Math.round(
					(executiveScore / maxExecutiveScore) * 10
				),
			},
			overallScore,
		};
	};

	// Render memory display
	const renderMemoryDisplay = () => (
		<div className="text-center p-8 bg-blue-50 rounded-lg">
			<div className="flex justify-center space-x-2 mb-4">
				{Array(countdownValue)
					.fill(0)
					.map((_, i) => (
						<div
							key={i}
							className="w-2 h-2 rounded-full bg-blue-500"
						></div>
					))}
			</div>
			<div className="flex flex-wrap justify-center gap-4 mb-4">
				{memoryItems.map((word, index) => (
					<div
						key={index}
						className="px-4 py-2 bg-white rounded shadow text-lg font-medium"
					>
						{word}
					</div>
				))}
			</div>
			<p className="text-sm text-blue-700 flex items-center justify-center">
				<Clock className="w-4 h-4 mr-1" />
				Memorize these words ({countdownValue}s remaining)
			</p>
		</div>
	);

	// Render question content based on type
	const renderQuestionContent = () => {
		const { type, question, choices, instructions } = currentQuestionData;

		// For memory task with words displayed
		if (type === "memory" && showMemoryItems) {
			return renderMemoryDisplay();
		}

		return (
			<div className="space-y-4">
				<h3 className="text-lg font-medium">{question}</h3>

				{instructions && (
					<p className="text-sm text-gray-500 italic">
						{instructions}
					</p>
				)}

				{isCountingDown && countdownValue > 0 && (
					<div className="flex items-center justify-center text-sm text-blue-600 mb-2">
						<Clock className="w-4 h-4 mr-1" />
						{countdownValue} seconds remaining
					</div>
				)}

				{answers[
					`${currentSectionData.id}_${currentQuestionData.id}_timerExpired`
				] && (
					<div className="flex items-center justify-center text-sm text-orange-600 mb-2">
						<Clock className="w-4 h-4 mr-1" />
						Time's up! Click Next to continue
					</div>
				)}

				{type === "memory" && !showMemoryItems && (
					<Button
						onClick={startMemoryTask}
						className="w-full"
						disabled={
							answers[
								`${currentSectionData.id}_${currentQuestionData.id}_memoryShown`
							]
						}
					>
						{answers[
							`${currentSectionData.id}_${currentQuestionData.id}_memoryShown`
						]
							? "Memory Words Already Shown"
							: "Show Memory Words"}
					</Button>
				)}

				{type === "choice" && choices && (
					<RadioGroup
						className="space-y-2"
						onValueChange={handleAnswerChange}
						value={
							answers[
								`${currentSectionData.id}_${currentQuestionData.id}`
							]
						}
					>
						{choices.map((choice, index) => (
							<div
								key={index}
								className="flex items-center space-x-2"
							>
								<RadioGroupItem
									value={choice}
									id={`choice-${index}`}
								/>
								<Label htmlFor={`choice-${index}`}>
									{choice}
								</Label>
							</div>
						))}
					</RadioGroup>
				)}

				{(type === "text" || type === "sequencing") && (
					<div className="space-y-2">
						{type === "sequencing" && choices && (
							<div className="flex flex-wrap gap-2 mb-3">
								{choices.map((choice, index) => (
									<Button
										key={index}
										variant={
											answers[
												`${currentSectionData.id}_${currentQuestionData.id}`
											] === choice
												? "default"
												: "outline"
										}
										onClick={() =>
											handleAnswerChange(choice)
										}
										disabled={
											answers[
												`${currentSectionData.id}_${currentQuestionData.id}_timerExpired`
											] ||
											(currentQuestionData.timerSeconds &&
												countdownValue === 0 &&
												!isCountingDown)
										}
										className="px-4"
									>
										{choice}
									</Button>
								))}
							</div>
						)}

						{type === "text" &&
							(question.length > 100 ? (
								<Textarea
									placeholder="Type your answer here..."
									value={
										answers[
											`${currentSectionData.id}_${currentQuestionData.id}`
										] || ""
									}
									onChange={(e) =>
										handleAnswerChange(e.target.value)
									}
									disabled={
										answers[
											`${currentSectionData.id}_${currentQuestionData.id}_timerExpired`
										] ||
										(currentQuestionData.timerSeconds &&
											countdownValue === 0 &&
											!isCountingDown)
									}
									className="w-full"
									rows={4}
								/>
							) : (
								<Input
									placeholder="Type your answer here..."
									value={
										answers[
											`${currentSectionData.id}_${currentQuestionData.id}`
										] || ""
									}
									onChange={(e) =>
										handleAnswerChange(e.target.value)
									}
									disabled={
										answers[
											`${currentSectionData.id}_${currentQuestionData.id}_timerExpired`
										] ||
										(currentQuestionData.timerSeconds &&
											countdownValue === 0 &&
											!isCountingDown)
									}
									className="w-full"
								/>
							))}
					</div>
				)}
			</div>
		);
	};

	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Cognitive & Language Assessment</CardTitle>
					<div className="flex items-center gap-1 text-sm text-slate-500">
						<span>
							Section {currentSection + 1}/{totalSections}
						</span>
						<span>•</span>
						<span>
							Question {currentQuestion + 1}/
							{totalQuestionsInSection}
						</span>
					</div>
				</div>
				<Progress value={progressPercent} className="h-2 mt-2" />
				<CardDescription>
					{currentSectionData.description}
				</CardDescription>
			</CardHeader>

			<CardContent>
				{errorMessage && (
					<Alert variant="destructive" className="mb-4">
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				{renderQuestionContent()}
			</CardContent>

			<CardFooter className="flex justify-between">
				<Button variant="outline" onClick={onCancel}>
					Skip Assessment
				</Button>

				<Button
					onClick={handleNextQuestion}
					disabled={
						// Disable Next button during active countdown
						(isCountingDown && countdownValue > 0) ||
						// For memory registration, disable Next only if memory words haven't been shown
						(currentQuestionData.type === "memory" &&
							currentQuestionData.id === "memory_registration" &&
							!answers[
								`${currentSectionData.id}_${currentQuestionData.id}_memoryShown`
							]) ||
						// Disable for non-timed questions with required answers (points > 0) that have no answer yet
						(!currentQuestionData.timerSeconds &&
							!answers[
								`${currentSectionData.id}_${currentQuestionData.id}`
							] &&
							currentQuestionData.type !== "memory" &&
							currentQuestionData.points > 0)
					}
				>
					{currentSection === totalSections - 1 &&
					currentQuestion === totalQuestionsInSection - 1 ? (
						"Finish Assessment"
					) : (
						<div className="flex items-center">
							Next <ChevronRight className="ml-1 h-4 w-4" />
						</div>
					)}
				</Button>
			</CardFooter>
		</Card>
	);
}

// Results Component to show after assessment
export function AssessmentResults({
	results,
	onContinue,
}: {
	results: AssessmentResultsSummary;
	onContinue: (level: string) => void;
}) {
	return (
		<Card className="w-full max-w-4xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center">
					<Brain className="mr-2 h-6 w-6 text-blue-600" />
					Assessment Results
				</CardTitle>
				<CardDescription>
					Based on your performance, we've determined the following
					profile:
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="bg-blue-50 p-6 rounded-lg text-center">
					<h3 className="text-xl font-bold mb-2">
						Recommended Language Level
					</h3>
					<div className="text-4xl font-bold text-blue-700 mb-3">
						{results.languageLevel}
					</div>
					<p className="text-sm text-slate-600">
						{getLevelDescription(results.languageLevel)}
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="bg-white p-4 border rounded-lg">
						<h4 className="font-medium mb-2 text-slate-600">
							Cognitive Profile
						</h4>
						<div className="space-y-3">
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Language Processing</span>
									<span>
										{results.cognitiveProfile.language}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.language * 10
									}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Memory</span>
									<span>
										{results.cognitiveProfile.memory}/10
									</span>
								</div>
								<Progress
									value={results.cognitiveProfile.memory * 10}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Attention</span>
									<span>
										{results.cognitiveProfile.attention}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.attention * 10
									}
									className="h-2"
								/>
							</div>
							<div>
								<div className="flex justify-between mb-1 text-sm">
									<span>Executive Function</span>
									<span>
										{results.cognitiveProfile.executive}/10
									</span>
								</div>
								<Progress
									value={
										results.cognitiveProfile.executive * 10
									}
									className="h-2"
								/>
							</div>
						</div>
					</div>

					<div className="bg-white p-4 border rounded-lg">
						<h4 className="font-medium mb-3 text-slate-600">
							What This Means For You
						</h4>
						<ul className="space-y-2 text-sm">
							{results.cognitiveProfile.memory >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong memory - you'll retain new
										vocabulary well
									</span>
								</li>
							)}
							{results.cognitiveProfile.memory < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll provide extra vocabulary
										reinforcement
									</span>
								</li>
							)}
							{results.cognitiveProfile.language >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong language skills - you can handle
										complex text
									</span>
								</li>
							)}
							{results.cognitiveProfile.language < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll simplify sentence structures when
										needed
									</span>
								</li>
							)}
							{results.cognitiveProfile.attention >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Great attention span - longer content
										works well
									</span>
								</li>
							)}
							{results.cognitiveProfile.attention < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll chunk content into smaller
										sections
									</span>
								</li>
							)}
							{results.cognitiveProfile.executive >= 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										Strong reasoning - complex concepts are
										fine
									</span>
								</li>
							)}
							{results.cognitiveProfile.executive < 7 && (
								<li className="flex items-start">
									<Check className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
									<span>
										We'll provide more visual aids for
										concepts
									</span>
								</li>
							)}
						</ul>
					</div>
				</div>
			</CardContent>

			<CardFooter className="justify-between flex-col sm:flex-row gap-3">
				<Button variant="outline" onClick={() => onContinue("B1")}>
					Use Default Level (B1)
				</Button>
				<Button onClick={() => onContinue(results.languageLevel)}>
					Continue with Recommended Level
				</Button>
			</CardFooter>
		</Card>
	);
}

function getLevelDescription(level: string) {
	const descriptions: Record<string, string> = {
		A1: "Beginner - Can understand and use familiar everyday expressions and basic phrases",
		A2: "Elementary - Can communicate in simple and routine tasks requiring simple and direct exchange of information",
		B1: "Intermediate - Can deal with most situations likely to arise while traveling in an area where the language is spoken",
		B2: "Upper Intermediate - Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers possible",
		C1: "Advanced - Can express ideas fluently and spontaneously without much obvious searching for expressions",
		C2: "Proficient - Can understand with ease virtually everything heard or read",
	};

	return descriptions[level] || "Intermediate level language abilities";
}

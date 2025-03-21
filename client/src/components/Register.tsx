// client/src/components/Register.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CognitiveProfile } from "@/types";

interface RegisterProps {
	onLoginClick: () => void;
	assessmentResults: {
		cognitiveProfile: CognitiveProfile;
		languageLevel: string;
	};
}

export function Register({ onLoginClick, assessmentResults }: RegisterProps) {
	const { signUp } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		try {
			await signUp(email, password, {
				cognitiveProfile: assessmentResults.cognitiveProfile,
				languageLevel: assessmentResults.languageLevel,
				completedAssessment: true,
			});
		} catch (error: any) {
			setError(error.message || "Failed to register");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader>
				<CardTitle>Create Your EquiLearn Account</CardTitle>
				<CardDescription>
					Register to save your profile and continue your learning
					journey
				</CardDescription>
			</CardHeader>
			<form onSubmit={handleSubmit}>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirmPassword">
							Confirm Password
						</Label>
						<Input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
						/>
					</div>
				</CardContent>
				<CardFooter className="flex flex-col space-y-2 mt-6">
					<Button
						type="submit"
						className="w-full"
						disabled={isLoading}
					>
						{isLoading ? "Creating Account..." : "Create Account"}
					</Button>
					<div className="text-sm text-center mt-2">
						<span className="text-gray-500">
							Already have an account?{" "}
						</span>
						<Button
							variant="link"
							className="p-0"
							onClick={onLoginClick}
						>
							Sign In
						</Button>
					</div>
				</CardFooter>
			</form>
		</Card>
	);
}

// client/src/components/Login.tsx
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

export function LoginForm({ onRegisterClick }: { onRegisterClick: () => void }) {
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		try {
			await signIn(email, password);
		} catch (error: any) {
			setError(error.message || "Failed to sign in");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardHeader>
				<CardTitle>Welcome Back to EquiLearn</CardTitle>
				<CardDescription>
					Sign in to continue your personalized learning journey
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
				</CardContent>
				<CardFooter className="flex flex-col space-y-2">
					<Button
						type="submit"
						className="w-full"
						disabled={isLoading}
					>
						{isLoading ? "Signing in..." : "Sign In"}
					</Button>
					<div className="text-sm text-center mt-2">
						<span className="text-gray-500">
							Don't have an account?{" "}
						</span>
						<Button
							variant="link"
							className="p-0"
							onClick={onRegisterClick}
						>
							Register
						</Button>
					</div>
				</CardFooter>
			</form>
		</Card>
	);
}

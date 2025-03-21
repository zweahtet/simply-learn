// client/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { CognitiveProfile } from "@/types";

interface AuthContextType {
	session: Session | null;
	user: User | null;
	profile: UserProfile | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (
		email: string,
		password: string,
		profile: UserProfile
	) => Promise<void>;
	signOut: () => Promise<void>;
}

interface UserProfile {
	id?: string;
	email?: string;
	languageLevel: string;
	cognitiveProfile: CognitiveProfile;
	completedAssessment: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();

	useEffect(() => {
		// Initial session check
		supabase.auth.getUser().then(({ data: { user } }) => {
			setUser(user);

			if (user) {
				fetchUserProfile(user.id);
			} else {
				setLoading(false);
			}
		});

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setUser(session?.user ?? null);

			if (session?.user) {
				fetchUserProfile(session.user.id);
			} else {
				setProfile(null);
				setLoading(false);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	async function fetchUserProfile(userId: string) {
		setLoading(true);
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();

			if (error) throw error;

			setProfile(data);
		} catch (error) {
			console.error("Error fetching user profile:", error);
		} finally {
			setLoading(false);
		}
	}

	async function signIn(email: string, password: string) {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw error;
	}

	async function signUp(
		email: string,
		password: string,
		userProfile: UserProfile
	) {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
		});

		if (error) throw error;

		if (data.user) {
			// Create user profile
			const { error: profileError } = await supabase
				.from("profiles")
				.insert([
					{
						id: data.user.id,
						email,
						cognitive_profile: userProfile.cognitiveProfile,
						completed_assessment: true,
					},
				]);

			if (profileError) throw profileError;
		}
	}

	async function signOut() {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	}

	const value = {
		session,
		user,
		profile,
		loading,
		signIn,
		signUp,
		signOut,
	};

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

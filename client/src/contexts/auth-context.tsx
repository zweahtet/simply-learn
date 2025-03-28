// client/src/contexts/AuthContext.tsx
"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { UserProfile } from "@/types";

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
	getJWTToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const supabase = createClient();

	useEffect(() => {
		// Initial session check
		supabase.auth.getUser().then(({ data: { user } }) => {
			if (user) {
				setUser(user);
				// fetchUserProfile(user.id);
			}
			setLoading(false);
		});

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (session && session.user) {
				setSession(session);
				setUser(session.user);
				// fetchUserProfile(session.user.id);
			}
			setLoading(false);
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

			console.log("Fetched user profile:", data);
			if (error) throw error;

			setProfile(data);
		} catch (error) {
			console.error("Error fetching user profile:", error);
		} finally {
			setLoading(false);
		}
	}

	async function signIn(email: string, password: string) {
		try {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (error) throw error;

			// Redirect to dashboard on successful login
			router.push("/dashboard");
		} catch (error) {
			throw error;
		}
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
						language_level: userProfile.languageLevel,
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

	async function getJWTToken() {
		const { data, error } = await supabase.auth.getSession();
		if (error) throw error;
		return data.session?.access_token;
	}

	const value = {
		session,
		user,
		profile,
		loading,
		signIn,
		signUp,
		signOut,
		getJWTToken,
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

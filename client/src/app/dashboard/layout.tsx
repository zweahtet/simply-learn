// app/dashboard/layout.tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadCloud, BookOpen, PenTool, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { profile, signOut } = useAuth();

	// Determine active tab from pathname
	const getActiveTab = () => {
		if (pathname.includes("/dashboard/content")) return "content";
		if (pathname.includes("/dashboard/exercises")) return "exercises";
		return "upload";
	};

	const handleTabChange = (value: string) => {
		router.push(`/dashboard/${value}`);
	};

	const handleSignOut = async () => {
		await signOut();
		router.push("/");
	};

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="flex justify-between items-center mb-8">
				<div>
					<h1 className="text-3xl font-bold">EquiLearn Dashboard</h1>
					<p className="text-gray-600">
						Personalized learning for {profile?.languageLevel || "B1"} level
					</p>
				</div>
				<Button variant="outline" onClick={handleSignOut}>
					<LogOut className="h-4 w-4 mr-2" />
					Sign Out
				</Button>
			</div>

			<Tabs
				value={getActiveTab()}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3 mb-8">
					<TabsTrigger value="upload" className="flex items-center">
						<UploadCloud className="h-4 w-4 mr-2" />
						Upload Content
					</TabsTrigger>
					<TabsTrigger value="content" className="flex items-center">
						<BookOpen className="h-4 w-4 mr-2" />
						Adapted Content
					</TabsTrigger>
					<TabsTrigger
						value="exercises"
						className="flex items-center"
					>
						<PenTool className="h-4 w-4 mr-2" />
						Practice Exercises
					</TabsTrigger>
				</TabsList>

				<div className="mt-4">{children}</div>
			</Tabs>
		</div>
	);
}

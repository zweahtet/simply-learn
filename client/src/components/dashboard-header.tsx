"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
	User,
	LogOut,
	Settings,
	BookOpen,
	Upload,
	FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardHeader() {
	const { user, profile, signOut } = useAuth();
	const router = useRouter();
	const isMobile = useIsMobile();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const handleSignOut = async () => {
		try {
			await signOut();
			router.push("/");
		} catch (error) {
			console.error("Error signing out:", error);
		}
	};

	const getInitials = (email: string) => {
		if (!email) return "U";
		return email.charAt(0).toUpperCase();
	};

	const getLevelColor = (level: string) => {
		const colors: { [key: string]: string } = {
			A1: "bg-amber-100 text-amber-800",
			A2: "bg-amber-200 text-amber-800",
			B1: "bg-blue-100 text-blue-800",
			B2: "bg-blue-200 text-blue-800",
			C1: "bg-indigo-100 text-indigo-800",
			C2: "bg-indigo-200 text-indigo-800",
		};
		return colors[level] || "bg-gray-100 text-gray-800";
	};

	return (
		<header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center justify-between py-4">
				<div className="flex items-center gap-4">
					<Link href="/dashboard" className="flex items-center gap-2">
						<BookOpen className="h-5 w-5 text-blue-600" />
						<h1 className="text-xl font-bold">EquiLearn</h1>
					</Link>

					{!isMobile && (
						<nav className="flex items-center space-x-4 lg:space-x-6 ml-6">
							<Button
								asChild
								variant="ghost"
								className="text-sm font-medium"
							>
								<Link href="/dashboard">
									<FileText className="h-4 w-4 mr-2" />
									My Content
								</Link>
							</Button>
							<Button
								asChild
								variant="ghost"
								className="text-sm font-medium"
							>
								<Link href="/dashboard/upload">
									<Upload className="h-4 w-4 mr-2" />
									Upload
								</Link>
							</Button>
						</nav>
					)}
				</div>

				<div className="flex items-center gap-4">
					{profile?.languageLevel && (
						<Badge className={getLevelColor(profile.languageLevel)}>
							{profile.languageLevel}
						</Badge>
					)}

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="relative h-9 w-9 rounded-full"
								aria-label="User menu"
							>
								<Avatar className="h-9 w-9">
									<AvatarFallback className="bg-blue-100 text-blue-600">
										{getInitials(user?.email || "")}
									</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel className="font-normal">
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium leading-none">
										{user?.email}
									</p>
									{profile?.languageLevel && (
										<p className="text-xs leading-none text-muted-foreground">
											Level: {profile.languageLevel}
										</p>
									)}
								</div>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem>
								<User className="mr-2 h-4 w-4" />
								<span>Profile</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Settings className="mr-2 h-4 w-4" />
								<span>Settings</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleSignOut}>
								<LogOut className="mr-2 h-4 w-4" />
								<span>Log out</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}

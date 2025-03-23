// simply-learn/client/src/components/dashboard-main.tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryTab } from "@/components/summary-tab";
import { SimplifiedTab } from "@/components/simplified-tab";
import { VideosTab } from "@/components/videos-tap";
import { FileMetadata } from "@/types";

interface MainContentProps {
    selectedFile: FileMetadata | null;
}

export function MainContent({ selectedFile }: MainContentProps) {
    const [activeTab, setActiveTab] = useState<string>("summary");

    return (
		<main className="flex flex-col h-full">
			<div className="flex h-14 items-center border-b px-4 md:px-6">
				<h1 className="text-lg font-semibold">
					{selectedFile ? selectedFile.name : "Dashboard"}
				</h1>
			</div>

			<div className="flex overflow-auto p-4 md:p-6">
				{!selectedFile ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-center text-muted-foreground">
							Select a file from the sidebar to view its content
						</p>
					</div>
				) : (
					<Tabs
						defaultValue="summary"
						value={activeTab}
						onValueChange={setActiveTab}
						className="h-full flex flex-col"
					>
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="summary">Summary</TabsTrigger>
							<TabsTrigger value="simplified">
								Simplified
							</TabsTrigger>
							<TabsTrigger value="videos">
								Supplemental Videos
							</TabsTrigger>
							<TabsTrigger value="study-guides">
								Study Guides
							</TabsTrigger>
						</TabsList>
						<div className="flex-1 overflow-auto mt-4">
							<TabsContent value="summary" className="h-full">
								<SummaryTab fileId={selectedFile.id} />
							</TabsContent>
							<TabsContent value="simplified" className="h-full">
								<SimplifiedTab fileId={selectedFile.id} />
							</TabsContent>
							<TabsContent value="videos" className="h-full">
								<VideosTab fileId={selectedFile.id} />
							</TabsContent>
							{/* <TabsContent
									value="study-guides"
									className="h-full"
								>
									<StudyGuidesTab fileId={selectedFile.id} />
								</TabsContent> */}
						</div>
					</Tabs>
				)}
			</div>
		</main>
	);
}
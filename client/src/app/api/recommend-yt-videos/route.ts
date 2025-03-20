// // src/app/api/recommend-yt-videos/route.ts
// import { NextResponse } from 'next/server';
// // import { qdrantClient } from '@/lib/setup/qdrantSetup';
// import { youtubeVectorSpace } from '@/lib/services/vectorDbService';
// import { generateContentEmbeddings, extractTopicsFromContent } from '@/lib/services/embeddingService';

// export async function POST(request: Request) {
//     try {
//         const { content, level } = await request.json();

//         if (!content) {
//             return NextResponse.json({
//                 success: false,
//                 error: "No content provided"
//             }, { status: 400 });
//         }

//         // Step 1: Extract key topics from the content
//         const topics = await extractTopicsFromContent(content);

//         // Step 2: Generate embedding for the content
//         const contentEmbedding = await generateContentEmbeddings(content);

//         // Step 3: Map CEFR level to difficulty levels for filtering
//         const difficultyLevels = mapCefrToDifficultyLevels(level);

//         // Step 4: Search for similar videos in Qdrant
//         const searchResults = await qdrantClient.search('youtube_educational_videos', {
//             vector: contentEmbedding,
//             filter: {
//                 must: [
//                     {
//                         key: "difficultyLevel",
//                         match: {
//                             any: difficultyLevels
//                         }
//                     },
//                     {
//                         key: "languageCode",
//                         match: {
//                             value: "en" // Assuming English videos for now
//                         }
//                     }
//                 ],
//                 should: [
//                     // Boost educational videos
//                     {
//                         key: "educationalRank",
//                         range: {
//                             gt: 0.7 // Prefer videos with higher educational value
//                         }
//                     },
//                     // Boost videos that match our topics
//                     {
//                         key: "topics",
//                         match: {
//                             any: topics
//                         }
//                     }
//                 ]
//             },
//             limit: 5,
//             with_payload: true,
//             score_threshold: 0.7 // Only return reasonably similar videos
//         });

//         // Step 5: Format the results for the frontend
//         const recommendedVideos = searchResults.map(result => ({
//             videoId: result.payload.videoId,
//             title: result.payload.title,
//             description: result.payload.description,
//             channelTitle: result.payload.channelTitle,
//             thumbnailUrl: `https://i.ytimg.com/vi/${result.payload.videoId}/mqdefault.jpg`,
//             duration: formatDuration(result.payload.duration),
//             topics: result.payload.topics,
//             difficultyLevel: result.payload.difficultyLevel,
//             relevanceScore: result.score,
//             matchedTopics: topics.filter(topic =>
//                 result.payload.topics?.includes(topic) ||
//                 result.payload.title.toLowerCase().includes(topic.toLowerCase()) ||
//                 result.payload.description.toLowerCase().includes(topic.toLowerCase())
//             )
//         }));

//         // Step 6: If no videos found, try a more general search
//         if (recommendedVideos.length === 0) {
//             const fallbackResults = await fallbackVideoSearch(topics, difficultyLevels);
//             return NextResponse.json({
//                 success: true,
//                 recommendedVideos: fallbackResults,
//                 searchType: "fallback"
//             });
//         }

//         return NextResponse.json({
//             success: true,
//             recommendedVideos,
//             searchType: "vector",
//             topics
//         });
//     } catch (error: any) {
//         console.error("Error recommending videos:", error);
//         return NextResponse.json({
//             success: false,
//             error: error.message
//         }, { status: 500 });
//     }
// }

// // Helper function to map CEFR levels to appropriate difficulty ranges
// function mapCefrToDifficultyLevels(level: string): string[] {
//     switch (level) {
//         case 'A1':
//             return ['A1', 'A2'];
//         case 'A2':
//             return ['A1', 'A2', 'B1'];
//         case 'B1':
//             return ['A2', 'B1', 'B2'];
//         case 'B2':
//             return ['B1', 'B2', 'C1'];
//         case 'C1':
//             return ['B2', 'C1', 'C2'];
//         case 'C2':
//             return ['C1', 'C2'];
//         default:
//             return ['B1', 'B2']; // Default to intermediate
//     }
// }

// // Format duration in seconds to MM:SS format
// function formatDuration(seconds: number): string {
//     if (!seconds) return '';
//     const minutes = Math.floor(seconds / 60);
//     const remainingSeconds = seconds % 60;
//     return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
// }

// // Fallback search when vector search returns no results
// async function fallbackVideoSearch(topics: string[], difficultyLevels: string[]) {
//     // Perform a keyword-based search instead
//     const keywordQuery = topics[0]; // Use the first topic

//     const fallbackResults = await qdrantClient.scroll('youtube_educational_videos', {
//         filter: {
//             must: [
//                 {
//                     key: "difficultyLevel",
//                     match: {
//                         any: difficultyLevels
//                     }
//                 },
//                 {
//                     key: "title",
//                     match: {
//                         text: keywordQuery
//                     }
//                 }
//             ]
//         },
//         limit: 3,
//         with_payload: true
//     });

//     // Format the results
//     return fallbackResults.points.map(point => ({
//         videoId: point.payload.videoId,
//         title: point.payload.title,
//         description: point.payload.description,
//         channelTitle: point.payload.channelTitle,
//         thumbnailUrl: `https://i.ytimg.com/vi/${point.payload.videoId}/mqdefault.jpg`,
//         duration: formatDuration(point.payload.duration),
//         topics: point.payload.topics,
//         difficultyLevel: point.payload.difficultyLevel,
//         relevanceScore: 0.5, // Default score for fallback results
//         matchedTopics: topics.filter(topic =>
//             point.payload.title.toLowerCase().includes(topic.toLowerCase()) ||
//             point.payload.description.toLowerCase().includes(topic.toLowerCase())
//         )
//     }));
// }
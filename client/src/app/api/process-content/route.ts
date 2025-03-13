import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@huggingface/transformers';
import { v4 as uuidv4 } from 'uuid';

// Initialize clients
const groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
});

const embeddingModel = await pipeline('embeddings', 'sentence-transformers/all-mpnet-base-v2')

// Helper function to split content into chunks
function splitContentIntoChunks(content: string, maxChunkSize = 500) {
    const paragraphs = content.split(/\n\s*\n/);
    const chunks = [];

    let currentChunk = '';

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = paragraph;
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

// Helper function to assess readability level
async function assessReadabilityLevel(text: string) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.length > 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const averageWordsPerSentence = words.length / sentences.length;
    const syllables = countSyllables(text);
    const averageSyllablesPerWord = syllables / words.length;

    const gradeLevel = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59;

    return Math.max(0, gradeLevel);
}

// Helper function to count syllables
function countSyllables(text: string) {
    const words = text.toLowerCase().split(/\s+/);
    let count = 0;

    words.forEach(word => {
        count += (word.match(/[aeiouy]{1,2}/g) || []).length;
        if ((word.match(/[aeiouy]{1,2}/g) || []).length === 0 && word.length > 0) {
            count += 1;
        }
    });

    return count;
}

// Ensure collection exists
async function ensureCollectionExists() {
    try {
        const collections = await qdrantClient.getCollections();
        if (!collections.collections.find(c => c.name === 'educational_content')) {
            await qdrantClient.createCollection('educational_content', {
                vectors: {
                    // size: 1536,
                    size: 768,
                    distance: 'Cosine'
                }
            });
            console.log("Created educational_content collection");
        }
    } catch (error) {
        console.error("Error ensuring collection exists:", error);
    }
}

export async function POST(request: Request) {
    try {
        const { content, title, source } = await request.json();

        // Ensure collection exists
        await ensureCollectionExists();

        // Split content into chunks
        const chunks = splitContentIntoChunks(content);

        // Process each chunk
        for (const chunk of chunks) {
            // For hackathon purposes, we'll use a mock embedding
            // In a real implementation, use proper embedding API
            // const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
            const chunkEmbedding = await embeddingModel(chunk, {
                pooling: 'mean',
                normalize: true
            })

            // Store in Qdrant
            await qdrantClient.upsert('educational_content', {
                points: [{
                    id: uuidv4(),
                    vector: Array.from(chunkEmbedding.data),
                    payload: {
                        content: chunk,
                        title,
                        source,
                        originalDifficulty: await assessReadabilityLevel(chunk)
                    }
                }]
            });
        }

        return NextResponse.json({
            success: true,
            result: {
                processedChunks: chunks.length
            }
        });
    } catch (error: any) {
        console.error("Error processing content:", error);
        if (error.data) {
            console.error("Qdrant error details:", error.data);
        }
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
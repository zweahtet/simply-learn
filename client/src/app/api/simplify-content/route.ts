// src/app/api/simplify-content/route.ts
import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { attachmentVectorSpace } from '@/lib/services/vectorDbService';
import { ModelCards } from '@/lib/defaults';

// Initialize clients
const groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Helper function to ensure collection exists
// async function ensureCollectionExists() {
//     try {
//         const collections = await qdrantClient.getCollections();
//         if (!collections.collections.find(c => c.name === 'pdf_collection')) {
//             await qdrantClient.createCollection('pdf_collection', {
//                 vectors: {
//                     size: 1536, // Dimension size for embeddings
//                     distance: 'Cosine'
//                 }
//             });
//             console.log("Created pdf_collection collection");
//         }
//     } catch (error) {
//         console.error("Error ensuring collection exists:", error);
//         // Don't throw here, try to continue with the request
//     }
// }

// export async function POST(request: Request) {
//     try {
//         const { content, level } = await request.json();

//         // First ensure the collection exists
//         await ensureCollectionExists();

//         // Generate embeddings using Groq
//         // Note: Using a simple embedding approach that works with the chat model
//         const embeddingResponse = await groqClient.chat.completions.create({
//             model: "llama-3.3-70b-versatile",
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are an expert at representing text as a 1536-dimensional embedding. Return the embedding as a JSON array of 1536 floating point numbers, and nothing else."
//                 },
//                 {
//                     role: "user",
//                     content: `Generate an embedding for this text: ${content.substring(0, 500)}...` // Truncate for efficiency
//                 }
//             ],
//             response_format: { type: "json_object" }
//         });

//         let embedding;
//         try {
//             // Try to parse the embedding from the model response
//             const responseContent = embeddingResponse.choices[0].message.content;
//             const jsonResponse = JSON.parse(responseContent || '{}');
//             embedding = jsonResponse.embedding || jsonResponse;

//             // Check if the embedding has the right dimension
//             if (!Array.isArray(embedding) || embedding.length !== 1536) {
//                 // Use a fallback approach - pseudo-random embedding
//                 console.warn("Invalid embedding format from model, using fallback");
//                 embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
//             }
//         } catch (error) {
//             console.error("Error parsing embedding:", error);
//             // Fallback to a pseudo-random embedding
//             embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
//         }

//         // Search Qdrant for relevant context
//         let relevantContext = "";
//         try {
//             const searchResults = await qdrantClient.search('divide_and_conquer', {
//                 vector: embedding,
//                 limit: 3, // Get top 3 most relevant documents
//             });

//             // Extract and combine relevant context
//             if (searchResults && searchResults.length > 0) {
//                 relevantContext = searchResults
//                     .map(result => result.payload?.text || "")
//                     .filter(text => typeof text === 'string' && text.trim().length > 0)
//                     .join('\n\n');
//             }
//         } catch (searchError) {
//             console.error("Error searching Qdrant:", searchError);
//             // Continue without relevant context if search fails
//         }

//         // Add context hint for debugging
//         const contextHint = relevantContext
//             ? "Using relevant context from your knowledge base."
//             : "No relevant context found in knowledge base.";

//         // Generate simplified content
//         const response = await groqClient.chat.completions.create({
//             model: "llama3-70b-8192", // Use the larger model for high-quality simplification
//             messages: [
//                 {
//                     role: "system",
//                     content: `You are an educational content adapter for ESL students at ${level} CEFR level.
//                     Simplify the text while preserving all key information.
//                     Use vocabulary and sentence structures appropriate for the target level.
//                     Format your response with HTML: Important terms should be wrapped in <strong> tags.
//                     Difficult concepts should include simple explanations in parentheses.
//                     Use <p> tags for paragraphs.

//                     ${relevantContext ? `Use the following relevant context to enhance your simplification:
//                     ${relevantContext}` : ""}

//                     Note: ${contextHint}`
//                 },
//                 { role: "user", content }
//             ]
//         });

//         return NextResponse.json({
//             success: true,
//             simplifiedContent: response.choices[0].message.content,
//             debug: { contextFound: relevantContext.length > 0 }
//         });
//     } catch (error: any) {
//         console.error("Error simplifying content:", error);
//         return NextResponse.json({
//             success: false,
//             error: error.message
//         }, { status: 500 });
//     }
// }

interface CognitiveProfile {
    memory: number;
    attention: number;
    language: number;
    visualSpatial: number;
    executive: number;
}

export async function POST(request: Request) {
    try {
        const { content, level, cognitiveProfile } = await request.json();

        if (!content || !level || !cognitiveProfile) {
            return NextResponse.json({
                success: false,
                error: "Missing content or level or cognitive profile in the request."
            }, { status: 400 });
        }

        // Ensure the collection exists
        // await ensureCollectionExists();

        // Create a customized system prompt based on cognitive profile
        const systemPrompt = generateSystemPrompt(level, cognitiveProfile);

        // Use Groq to adapt the content
        const response = await groqClient.chat.completions.create({
            model: ModelCards.LLAMA_70B_versatile,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                { role: "user", content }
            ],
            temperature: 0.3, // Lower temperature for more predictable output
            top_p: 0.8
        });

        return NextResponse.json({
            success: true,
            adaptedContent: response.choices[0].message.content
        });
    } catch (error: any) {
        console.error("Error adapting content:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Generate a system prompt that takes into account both language level and cognitive profile
function generateSystemPrompt(level: string, cognitiveProfile?: CognitiveProfile): string {
    // Default cognitive profile if none provided
    const profile = cognitiveProfile || {
        memory: 5,
        attention: 5,
        language: 5,
        visualSpatial: 5,
        executive: 5
    };

    // Base prompt for language level
    let basePrompt = `You are an educational content adapter for ESL students at ${level} CEFR level. 
    Your task is to transform educational content to be more accessible while preserving all key information.
    Use vocabulary and sentence structures appropriate for the ${level} proficiency level.`;

    // Customizations based on cognitive profile
    let customizations = [];
    let formatting = [];

    // Memory adaptations
    if (profile.memory <= 3) {
        customizations.push(`
            The learner has difficulty with memory, so:
            - Repeat key terms multiple times
            - Use mnemonic devices where possible
            - Create clear associations between new terms and familiar concepts`);

        formatting.push(`
            - Create a "Key Terms" box at the end of each section to reinforce vocabulary
            - Use bullet points for lists rather than embedding them in paragraphs`);
    } else if (profile.memory >= 7) {
        customizations.push(`
            The learner has strong memory abilities, so:
            - Feel free to introduce new vocabulary with proper context
            - Use recall questions to reinforce learning`
        );
    }

    // Attention adaptations
    if (profile.attention <= 3) {
        customizations.push(`
            The learner has limited attention span, so:
            - Keep paragraphs very short (3-4 sentences maximum)
            - Break content into many small, focused sections
            - Use frequent subheadings to structure content`);

        formatting.push(`
            - Add a "Summary" after every 2-3 paragraphs
            - Use visual markers like ⚠️ or 🔑 to highlight important points`);
    } else if (profile.attention >= 7) {
        customizations.push(`
            The learner has strong attention abilities, so:
            - You can present longer, cohesive sections of content
            - Include more detailed explanations where relevant`
        );
    }

    // Language processing adaptations
    if (profile.language <= 3) {
        customizations.push(`
            The learner needs additional language support, so:
            - Use very simple sentence structures (subject-verb-object)
            - Avoid idioms, phrasal verbs, and figurative language
            - Define terms immediately when introduced`);

        formatting.push(`
            - Present definitions in parentheses right after introducing a term
            - Use simple illustrations or diagrams where possible`);
    } else if (profile.language >= 7) {
        customizations.push(`
            The learner has strong language abilities for their level, so:
            - You can use more complex sentence structures within their level
            - Introduce some common idiomatic expressions with explanations`);
    }

    // Executive function adaptations
    if (profile.executive <= 3) {
        customizations.push(`
            The learner may need support with concepts and reasoning, so:
            - Break complex concepts into explicit steps
            - Provide concrete examples for abstract ideas
            - Use clear cause-effect language`);

        formatting.push(`
            - Use numbered lists for processes or sequences
            - Create "If-Then" statements for conditional content`);
    } else if (profile.executive >= 7) {
        customizations.push(`
            The learner has strong reasoning abilities, so:
            - Present challenging concept relationships
            - Include questions that require synthesis of information`);
    }

    // Combine the base prompt with customizations
    let finalPrompt = basePrompt;

    if (customizations.length > 0) {
        finalPrompt += `\n\nBased on the learner's cognitive profile, make these adjustments:${customizations.join('')}`;
    }

    if (formatting.length > 0) {
        finalPrompt += `\n\nUse these formatting approaches:${formatting.join('')}`;
    }

    // Add HTML formatting instructions
    finalPrompt += `\n\nFormat your response with HTML:
    - Important terms should be wrapped in <strong> tags
    - Use <p> tags for paragraphs
    - Use <h3> tags for section headings
    - Use <ul> and <li> tags for lists
    - If creating a key terms box, use <div class="key-terms"> to wrap it
    - If creating a summary, use <div class="summary"> to wrap it
    
    Preserve all key information while making the text accessible to a ${level} level English learner with the specific cognitive profile described.`;

    return finalPrompt;
}
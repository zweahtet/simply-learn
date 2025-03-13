// src/app/api/generate-exercises/route.ts
import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
    try {
        const { content, level } = await request.json();

        const response = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are an educational content creator specializing in ESL (English as a Second Language) materials for ${level} CEFR level students. Your task is to create structured practice exercises based on the provided content.
                    The exercises should be formatted in clean HTML with the following structure and guidelines:

                    <div class="exercise-set">                        
                        <!-- VOCABULARY SECTION -->
                        <section class="exercise">
                            <h3 class="exercise-title">Vocabulary Practice</h3>
                            <p class="exercise-instructions">Match the words with their definitions.</p>
                            
                            <div class="vocabulary-exercise">
                            <div class="word-list">
                                <!-- List important vocabulary words from the content, appropriate for ${level} level -->
                                <div class="word-item"><strong>Word 1</strong></div>
                                <div class="word-item"><strong>Word 2</strong></div>
                                <!-- Add 6-8 words total -->
                            </div>
                            
                            <div class="definition-list">
                                <!-- Provide definitions in a different order than the words -->
                                <div class="definition-item">Definition of word 2</div>
                                <div class="definition-item">Definition of word 1</div>
                                <!-- Matching number of definitions -->
                            </div>
                            </div>
                            
                            <div class="follow-up">
                            <p>Use 3 of these words in your own sentences.</p>
                            </div>
                        </section>
                        
                        <!-- COMPREHENSION SECTION -->
                        <section class="exercise">
                            <h3 class="exercise-title">Reading Comprehension</h3>
                            <p class="exercise-instructions">Answer the following questions based on the text.</p>
                            
                            <div class="comprehension-questions">
                            <!-- Create 5 questions of increasing difficulty -->
                            <!-- For A1-A2: Focus on factual, directly stated information -->
                            <!-- For B1-B2: Include some inference questions -->
                            <!-- For C1-C2: Include analysis and evaluation questions -->
                            
                            <div class="question">
                                <p class="question-text">1. Question about a main concept in the text?</p>
                                <div class="answer-options">
                                <!-- For A1-B1 levels, provide multiple choice options -->
                                <!-- For B2-C2 levels, use open-ended questions -->
                                <div class="option">a) Correct answer</div>
                                <div class="option">b) Incorrect but plausible answer</div>
                                <div class="option">c) Incorrect answer</div>
                                </div>
                            </div>
                            
                            <!-- Add 4 more questions following similar pattern -->
                            </div>
                        </section>
                        
                        <!-- WRITING SECTION -->
                        <section class="exercise">
                            <h3 class="exercise-title">Writing Practice</h3>
                            <p class="exercise-instructions">Complete the following writing task.</p>
                            
                            <div class="writing-prompt">
                            <!-- Create an appropriate writing task for the level -->
                            <!-- A1-A2: 30-50 words, simple prompt related to the content -->
                            <!-- B1-B2: 100-150 words, with specific requirements -->
                            <!-- C1-C2: 200-250 words, analytical or argumentative -->
                            
                            <p class="prompt-text">Write a ${getWritingLength(level)} about ${getWritingTopic(level)}. ${getAdditionalInstructions(level)}</p>
                            
                            <div class="writing-guidelines">
                                <p>Remember to:</p>
                                <ul>
                                <li>Include an introduction, main points, and conclusion</li>
                                <li>Use vocabulary from the text</li>
                                <li>Check your grammar and spelling</li>
                                </ul>
                            </div>
                            </div>
                        </section>
                    </div>

                    Create exercises that are challenging but achievable for a ${level} level student. Use clear, direct language in instructions and ensure all content is directly related to the provided text.`
                },
                { role: "user", content }
            ]
        });

        return NextResponse.json({
            success: true,
            exercises: response.choices[0].message.content
        });
    } catch (error: any) {
        console.error("Error generating exercises:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Helper functions to tailor writing assignments to CEFR levels
function getWritingLength(level: string): string {
    switch (level) {
        case 'A1': return 'short paragraph (30-50 words)';
        case 'A2': return 'paragraph (50-80 words)';
        case 'B1': return 'short text (100-120 words)';
        case 'B2': return 'composition (150-180 words)';
        case 'C1': return 'essay (200-250 words)';
        case 'C2': return 'detailed essay (250-300 words)';
        default: return 'text (100-150 words)';
    }
}

function getWritingTopic(level: string): string {
    switch (level) {
        case 'A1':
        case 'A2':
            return 'what you learned from the text';
        case 'B1':
        case 'B2':
            return 'how this topic relates to your experience or interests';
        case 'C1':
        case 'C2':
            return 'the implications of this topic and your analysis of its importance';
        default:
            return 'the main points from this text';
    }
}

function getAdditionalInstructions(level: string): string {
    switch (level) {
        case 'A1': return 'Use simple sentences.';
        case 'A2': return 'Use present and past tense verbs.';
        case 'B1': return 'Include your opinion and use linking words (however, therefore, etc.).';
        case 'B2': return 'Support your ideas with examples and use a variety of sentence structures.';
        case 'C1': return 'Develop a well-structured argument with supporting evidence.';
        case 'C2': return 'Demonstrate a sophisticated use of vocabulary and complex grammatical structures.';
        default: return 'Organize your ideas clearly.';
    }
}
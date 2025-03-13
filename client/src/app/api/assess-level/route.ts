// src/app/api/assess-level/route.ts
import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groqClient = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
    try {
        const { response } = await request.json();

        const result = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are an ESL assessment expert. Analyze the text and determine the CEFR level (A1-C2) based on vocabulary, grammar, and complexity. Respond with only the level designation."
                },
                { role: "user", content: response }
            ]
        });

        return NextResponse.json({
            success: true,
            level: result.choices[0]?.message?.content?.trim() || "Cannot determine level"
        });
    } catch (error: any) {
        console.error("Error assessing level:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
// app/api/limits/route.js
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Endpoint to check current rate limit status
export async function GET(request: Request) {
    try {
        // Check the current rate limit status
        const { success, limit, remaining, reset } = await checkRateLimit(request);

        return NextResponse.json(
            {
                success: true,
                limits: {
                    total: limit,
                    remaining,
                    used: limit - remaining,
                    resetAt: new Date(reset).toISOString(),
                    resetIn: Math.floor((reset - Date.now()) / 1000) // seconds until reset
                }
            },
            {
                status: 200,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Remaining": remaining.toString(),
                    "X-RateLimit-Reset": reset.toString()
                }
            }
        );
    } catch (error) {
        console.error("Error checking rate limit:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to retrieve rate limit information"
            },
            { status: 500 }
        );
    }
}
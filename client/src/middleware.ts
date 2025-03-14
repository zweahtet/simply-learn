// middleware.js
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Paths that should be rate-limited
const RATE_LIMITED_PATHS = [
    // "/api/submit-form",
    // "/api/upload-file",
    // "/api/create-item",
    // Add any other paths that should be rate-limited
    "/api/simplify-content",
    "/api/generate-exercises",
];

export async function middleware(request: Request) {
    const { pathname } = new URL(request.url);

    // Only apply rate limiting to specified paths
    if (RATE_LIMITED_PATHS.some(path => pathname.startsWith(path))) {
        // Check rate limit
        const { success, limit, remaining, reset } = await checkRateLimit(request);

        // If rate limit exceeded
        if (!success) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    message: "You've reached the maximum number of actions for today. Please try again tomorrow.",
                    limit,
                    remaining: 0,
                    resetAt: new Date(reset).toISOString()
                }),
                {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "X-RateLimit-Limit": limit.toString(),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": reset.toString(),
                        "Retry-After": Math.floor((reset - Date.now()) / 1000).toString()
                    }
                }
            );
        }

        // If within rate limit, add headers and continue
        const response = NextResponse.next();
        response.headers.set("X-RateLimit-Limit", limit.toString());
        response.headers.set("X-RateLimit-Remaining", remaining.toString());
        response.headers.set("X-RateLimit-Reset", reset.toString());

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Match all API routes
        "/api/:path*",
        // Add other routes as needed
    ],
};
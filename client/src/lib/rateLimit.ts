// lib/rateLimit.js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";

// Initialize Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create a rate limiter instance
// This limits to 5 actions per day per user identifier
const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 d"), // 5 requests per day
    analytics: true, // Enable analytics on Upstash dashboard
    prefix: "app:ratelimit",
});

// Cookie name for anonymous tracking
const COOKIE_NAME = "visitor_id";

/**
 * Gets a unique identifier for the current visitor
 */
export async function getVisitorId(request: Request) {
    const cookieStore = await cookies();

    // Try to get existing visitor ID
    let visitorId = cookieStore.get(COOKIE_NAME)?.value;

    // If no visitor ID exists, create one
    if (!visitorId) {
        visitorId = crypto.randomUUID();
        cookieStore.set(COOKIE_NAME, visitorId, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
    }

    // Combine with IP for additional security
    const ip = request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "127.0.0.1";

    return `${visitorId}:${ip}`;
}

/**
 * Check if a request is within rate limits
 */
export async function checkRateLimit(request: Request) {
    const identifier = await getVisitorId(request);
    return await limiter.limit(identifier);
}
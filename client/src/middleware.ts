// simply-learn/client/src/middleware.js
import { NextResponse, NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { updateSession } from "@/lib/supabase/middleware";

// Paths that should be rate-limited
const RATE_LIMITED_PATHS = [
    // "/api/simplify-content",
    // "/api/generate-exercises",
    "/api/files/upload",
];

// Public paths that don't require authentication
const PUBLIC_PATHS = [
    "/",
    "/login",
    "/register",
    "/assessment",
    "/_next",
    "/api/auth",
    "/images",
    "/fonts",
]

// export async function middleware(request: NextRequest) {
//     const { pathname } = new URL(request.url);

//     // First, handle Supabase authentication
//     // This will redirect to login page if needed and handle auth cookies
//     let response = await updateSession(request);

//     // Check if we got a redirect response from updateSession
//     // If so, just return it immediately
//     if (response.status === 307) {
//         return response;
//     }

//     // Public paths that bypass additional middleware checks
//     if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
//         return response;
//     }

//     // Apply rate limiting to specified API paths
//     if (RATE_LIMITED_PATHS.some(path => pathname.startsWith(path))) {
//         try {
//             // Check rate limit
//             const { success, limit, remaining, reset } = await checkRateLimit(request);

//             // If rate limit exceeded
//             if (!success) {
//                 return new NextResponse(
//                     JSON.stringify({
//                         success: false,
//                         message: "You've reached the maximum number of actions for today. Please try again tomorrow.",
//                         limit,
//                         remaining: 0,
//                         resetAt: new Date(reset).toISOString()
//                     }),
//                     {
//                         status: 429,
//                         headers: {
//                             "Content-Type": "application/json",
//                             "X-RateLimit-Limit": limit.toString(),
//                             "X-RateLimit-Remaining": "0",
//                             "X-RateLimit-Reset": reset.toString(),
//                             "Retry-After": Math.floor((reset - Date.now()) / 1000).toString()
//                         }
//                     }
//                 );
//             }

//             // Add rate limit headers to successful requests
//             // IMPORTANT: Create a new response to avoid modifying the Supabase response
//             const ratelimitedResponse = NextResponse.next({
//                 request: request,
//             });

//             // Copy all cookies from the Supabase response
//             response.cookies.getAll().forEach(cookie => {
//                 ratelimitedResponse.cookies.set(cookie.name, cookie.value, cookie);
//             });

//             // Add rate limit headers
//             ratelimitedResponse.headers.set("X-RateLimit-Limit", limit.toString());
//             ratelimitedResponse.headers.set("X-RateLimit-Remaining", remaining.toString());
//             ratelimitedResponse.headers.set("X-RateLimit-Reset", reset.toString());

//             return ratelimitedResponse;
//         } catch (error) {
//             console.error("Rate limit error:", error);
//         // Return original response if rate limiting fails
//             return response;
//         }
//     }

//     return response;
// }


// export const config = {
//     matcher: [
//         // Match all routes except for API routes not requiring auth
//         '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
//     ],
// };

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
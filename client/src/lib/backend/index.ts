import { createClient } from "../supabase/client";

interface ApplicationError extends Error {
    info: string;
    status: number;
}

interface FetchOptions extends RequestInit {
    auth?: boolean;
}

class RestClient {
    baseUrl?: string;
    defaultOpts: RequestInit;

    constructor(opts: { baseUrl?: string; defaultOpts?: RequestInit }) {
        this.baseUrl = opts.baseUrl?.replace(/\/$/, ""); // Remove trailing slash
        this.defaultOpts = opts.defaultOpts ?? {};
    }

    /**
     * Fetch data from the API endpoint
     * @param resource url path
     * @param options 
     * @returns HTTP response
     */
    async fetch(resource: string, options: FetchOptions = {}): Promise<Response> {
        const { auth = true, ...fetchOpts } = options;
        const normalizedResource = resource.startsWith("/") ? resource : `/${resource}`;
        const url = this.baseUrl ? `${this.baseUrl}${normalizedResource}` : normalizedResource;

        // Prepare headers
        const headers = new Headers(this.defaultOpts.headers);

        if (auth) {
            const { session, error } = await this.getSession();
            if (error) throw error;
            if (!session) throw new Error("No Supabase session found");
            headers.set("Authorization", `Bearer ${session.access_token}`);
        }

        // Merge headers from request options
        const requestHeaders = new Headers(fetchOpts.headers);
        requestHeaders.forEach((value, key) => headers.set(key, value));

        // Create final request options
        const mergedOpts: RequestInit = {
            ...this.defaultOpts,
            ...fetchOpts,
            headers,
        };

        return fetch(url, mergedOpts);
    }

    /**
     * Use with next.js server-side rendering to fetch data with authentication.
     * @param url 
     * @returns 
     */
    async fetchWithAuth(url: string) {
        const response = await this.fetch(url, { auth: true });
        if (!response.ok) {
            const error = new Error("An error occurred while fetching the data.") as ApplicationError;
            error.info = await response.json();
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    /**
     * Use with next.js server-side rendering to fetch data without authentication.
     * @param url 
     * @returns 
     */
    async fetchWithoutAuth(url: string) {
        const response = await this.fetch(url, { auth: false });
        if (!response.ok) {
            const error = new Error("An error occurred while fetching the data.") as ApplicationError;
            error.info = await response.json();
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    private async getSession() {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        return { session: data?.session, error };
    }
}

export const restClient = new RestClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    defaultOpts: {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    },
});
// Centralized CORS configuration

// Whitelist of allowed origins. Using a Set for efficient lookups.
// We allow the main host URL (e.g., http://localhost:3000) and the Traefik proxy entrypoint.
const allowedOrigins = new Set([
	process.env.HOST_URL,
	process.env.LAB_ORIGIN_URL, // URL for labs (e.g., http://localhost)
]);

/**
 * Generates dynamic CORS headers based on the request's origin.
 * If the origin is in the whitelist, it is allowed.
 *
 * @param requestOrigin The 'Origin' header from the incoming request.
 * @returns A HeadersInit object with the appropriate CORS headers.
 */
export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
	const headers: HeadersInit = {
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-control-allow-headers": "Content-Type, Authorization",
		"Access-Control-Allow-Credentials": "true",
	};

	if (requestOrigin && allowedOrigins.has(requestOrigin)) {
		headers["Access-Control-Allow-Origin"] = requestOrigin;
	} else {
		// For security, if the origin is not allowed, we don't set the header.
		// Browsers will then enforce the same-origin policy.
	}

	return headers;
}

// Enhanced API security utilities
import { NextRequest } from "next/server";
import { getAuthUser } from "./auth";

// We can re-use the allowedOrigins from the cors-config, but to avoid
// circular dependencies and keep this module self-contained for security logic,
// we define it here. It should be kept in sync with cors-config.ts.
const allowedOrigins = new Set([
	process.env.HOST_URL,
	process.env.LAB_ORIGIN_URL,
]);

interface SecurityCheck {
	isValid: boolean;
	error?: string;
	user?: any;
}

export async function validateLabApiRequest(
	request: NextRequest
): Promise<SecurityCheck> {
	// 1. Origin validation
	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");

	if (origin && !allowedOrigins.has(origin)) {
		return { isValid: false, error: "Invalid origin" };
	}

	// 2. Referer check (additional security layer)
	// Ensure the referer, if present, starts with an allowed origin URL.
	if (
		referer &&
		![...allowedOrigins].some(
			(allowed) => allowed && referer.startsWith(allowed)
		)
	) {
		return { isValid: false, error: "Invalid referer" };
	}

	// 3. Authentication check
	const user = await getAuthUser(request);
	if (!user) {
		return { isValid: false, error: "Unauthorized" };
	}

	// 4. Rate limiting check (basic implementation)
	const userAgent = request.headers.get("user-agent") || "";
	if (userAgent.includes("bot") || userAgent.includes("crawler")) {
		return { isValid: false, error: "Automated requests not allowed" };
	}

	return { isValid: true, user };
}

// Request frequency tracking (in-memory, use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
	userId: string,
	maxRequests = 10,
	windowMs = 60000
): boolean {
	const now = Date.now();
	const userKey = `lab_api_${userId}`;
	const userCount = requestCounts.get(userKey);

	if (!userCount || now > userCount.resetTime) {
		requestCounts.set(userKey, { count: 1, resetTime: now + windowMs });
		return true;
	}

	if (userCount.count >= maxRequests) {
		return false;
	}

	userCount.count++;
	return true;
}

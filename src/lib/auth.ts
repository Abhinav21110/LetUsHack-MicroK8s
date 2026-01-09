// AUTH_RESTRICTION_REENABLED
// Centralized auth utilities for local JWT authentication

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
	process.env.JWT_SECRET_LOCAL || "dev-secret-change-me"
);

const COOKIE_NAME = "auth_token";
const JWT_EXPIRES_IN = "24h";

interface AuthUser {
	user_id: string;
	name?: string;
	role?: string;
}

export async function signToken(payload: AuthUser): Promise<string> {
	const token = await new SignJWT({ ...payload })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(JWT_EXPIRES_IN)
		.sign(JWT_SECRET);

	return token;
}

interface JWTPayload {
	user_id: string;
	name?: string;
	role?: string;
	[key: string]: unknown;
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);
		const jwtPayload = payload as JWTPayload;

		if (!jwtPayload.user_id) {
			return null;
		}

		return {
			user_id: jwtPayload.user_id,
			name: jwtPayload.name,
			role: jwtPayload.role,
		};
	} catch (error) {
		return null;
	}
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
	const token = req.cookies.get(COOKIE_NAME)?.value;

	// Log cookie read attempt
	console.log("[COOKIE_READ]", {
		at: new Date().toISOString(),
		tokenPresent: !!token,
	});

	if (!token) return null;

	const user = await verifyToken(token);

	if (user) {
		console.log("[TOKEN_VALIDATED]", {
			at: new Date().toISOString(),
			userId: user.user_id,
		});
	} else {
		console.log("[TOKEN_INVALID]", {
			at: new Date().toISOString(),
		});
	}

	return user;
}

interface SetAuthCookieOptions {
	secure?: boolean; // override secure flag
	sameSite?: "lax" | "strict" | "none";
}

export function setAuthCookie(
	response: NextResponse,
	token: string,
	opts: SetAuthCookieOptions = {}
): void {
	const defaultSecure = process.env.NODE_ENV === "production";
	const secure = typeof opts.secure === "boolean" ? opts.secure : defaultSecure;
	const sameSite =
		opts.sameSite ?? (process.env.NODE_ENV === "production" ? "strict" : "lax");

	response.cookies.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure,
		sameSite,
		path: "/",
		maxAge: 60 * 60 * 24, // 24 hours
	});

	// Log cookie set
	console.log("[COOKIE_SET]", {
		at: new Date().toISOString(),
		secure,
		sameSite,
	});
}

export function clearAuthCookie(response: NextResponse): void {
	response.cookies.delete(COOKIE_NAME);

	// Log cookie cleared
	console.log("[COOKIE_CLEARED]", {
		at: new Date().toISOString(),
	});
}

export async function requireAuth(
	req: NextRequest
): Promise<{ user: AuthUser | null; redirect?: NextResponse }> {
	const user = await getAuthUser(req);

	if (!user) {
		const url = new URL("/login", req.url);
		url.searchParams.set("from", req.nextUrl.pathname);
		return {
			user: null,
			redirect: NextResponse.redirect(url),
		};
	}

	return { user };
}

// Client-side auth check
export async function checkAuthStatus(): Promise<AuthUser | null> {
	try {
		const res = await fetch("/api/auth/check");
		if (!res.ok) return null;
		const data = await res.json();
		return data.user;
	} catch (error) {
		return null;
	}
}

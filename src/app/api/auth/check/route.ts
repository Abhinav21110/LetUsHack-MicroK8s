// AUTH_RESTRICTION_REENABLED
// API endpoint to check authentication status

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors-config";

export async function OPTIONS(req: NextRequest) {
	const requestOrigin = req.headers.get("origin");
	const headers = getCorsHeaders(requestOrigin);
	return new Response(null, {
		status: 204, // Use 204 for preflight success
		headers: headers,
	});
}

export async function GET(req: NextRequest) {
	const requestOrigin = req.headers.get("origin");
	const headers = getCorsHeaders(requestOrigin);
	const user = await getAuthUser(req);

	if (!user) {
		return NextResponse.json(
			{
				authenticated: false,
				user: null,
			},
			{
				headers: headers,
			}
		);
	}

	return NextResponse.json(
		{
			authenticated: true,
			user: {
				user_id: user.user_id,
				name: user.name,
				role: user.role || 'student',
			},
		},
		{
			headers: headers,
		}
	);
}

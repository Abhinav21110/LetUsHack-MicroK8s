import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Pool } from "pg";
import { getCorsHeaders } from "@/lib/cors-config";

const pool = new Pool({
	host: process.env.PGHOST || "localhost",
	port: parseInt(process.env.PGPORT || "5432"),
	database: process.env.PGDATABASE || "letushack_db",
});

export async function OPTIONS(req: NextRequest) {
	const requestOrigin = req.headers.get("origin");
	const headers = getCorsHeaders(requestOrigin);
	return new Response(null, {
		status: 204, // Use 204 for preflight success
		headers: headers,
	});
}

export async function GET(request: NextRequest) {
	const requestOrigin = request.headers.get("origin");
	const corsHeaders = getCorsHeaders(requestOrigin);
	try {
		// Get user from httpOnly cookie
		const user = await getAuthUser(request);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401, headers: corsHeaders }
			);
		}

		const { searchParams } = new URL(request.url);
		const lab_id_param = searchParams.get("lab_id");

		if (!lab_id_param) {
			return NextResponse.json(
				{ success: false, error: "lab_id is required" },
				{ status: 400, headers: corsHeaders }
			);
		}

		const lab_id = parseInt(lab_id_param);
		if (isNaN(lab_id)) {
			return NextResponse.json(
				{ success: false, error: "lab_id must be a valid integer" },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Get lab scores for the user and lab
		const result = await pool.query(
			"SELECT user_id, lab_id, level, score, solved, submitted_at FROM lab_scores WHERE user_id = $1 AND lab_id = $2 ORDER BY level",
			[user.user_id, lab_id]
		);

		return NextResponse.json(
			{
				success: true,
				data: result.rows,
			},
			{
				headers: corsHeaders,
			}
		);
	} catch (error) {
		console.error("Error fetching lab status:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500, headers: corsHeaders }
		);
	}
}

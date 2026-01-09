import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Pool } from "pg";
import { getCorsHeaders } from "@/lib/cors-config";

const pool = new Pool({
	host: process.env.PGHOST || "localhost",
	port: parseInt(process.env.PGPORT || "5432"),
	user: process.env.PGUSER || "postgres",
	password: process.env.PGPASSWORD,
	database: process.env.PGDATABASE || "letushack_db",
});

export async function OPTIONS(req: NextRequest) {
	const requestOrigin = req.headers.get("origin");
	const headers = getCorsHeaders(requestOrigin);
	return new Response(null, {
		status: 204,
		headers: headers,
	});
}

export async function POST(request: NextRequest) {
	const requestOrigin = request.headers.get("origin");
	const corsHeaders = getCorsHeaders(requestOrigin);
	try {
		console.log("[LAB_SCORE_UPDATE] Request received");

		// Get user from httpOnly cookie
		const user = await getAuthUser(request);
		console.log("[LAB_SCORE_UPDATE] User auth result:", {
			authenticated: !!user,
			userId: user?.user_id,
		});

		if (!user) {
			console.log("[LAB_SCORE_UPDATE] Unauthorized - no user");
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401, headers: corsHeaders }
			);
		}

		const body = await request.json();
		console.log("[LAB_SCORE_UPDATE] Request body:", body);

		const { lab_id, level, score, solved } = body;

		if (
			lab_id === undefined ||
			level === undefined ||
			score === undefined ||
			solved === undefined
		) {
			console.log("[LAB_SCORE_UPDATE] Missing required fields");
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Validate that lab_id and level are integers
		if (!Number.isInteger(lab_id) || !Number.isInteger(level)) {
			console.log("[LAB_SCORE_UPDATE] Invalid data types:", {
				lab_id: typeof lab_id,
				level: typeof level,
			});
			return NextResponse.json(
				{ success: false, error: "lab_id and level must be integers" },
				{ status: 400, headers: corsHeaders }
			);
		}

		console.log("[LAB_SCORE_UPDATE] Checking existing record for:", {
			user_id: user.user_id,
			lab_id,
			level,
		});

		// Check if record already exists and is solved
		const existingRecord = await pool.query(
			"SELECT solved FROM lab_scores WHERE user_id = $1 AND lab_id = $2 AND level = $3",
			[user.user_id, lab_id, level]
		);

		console.log(
			"[LAB_SCORE_UPDATE] Existing record check result:",
			existingRecord.rows
		);

		if (existingRecord.rows.length > 0 && existingRecord.rows[0].solved) {
			console.log("[LAB_SCORE_UPDATE] Lab already completed");
			return NextResponse.json(
				{ success: false, error: "Lab already completed" },
				{ status: 400, headers: corsHeaders }
			);
		}

		console.log("[LAB_SCORE_UPDATE] Inserting/updating lab score:", {
			user_id: user.user_id,
			lab_id,
			level,
			score,
			solved,
		});

		// Check if record exists, then either INSERT or UPDATE
		if (existingRecord.rows.length > 0) {
			// Update existing record
			await pool.query(
				`
        UPDATE lab_scores 
        SET score = $4, solved = $5, submitted_at = $6
        WHERE user_id = $1 AND lab_id = $2 AND level = $3
      `,
				[user.user_id, lab_id, level, score, solved, new Date()]
			);
			console.log("[LAB_SCORE_UPDATE] Updated existing record");
		} else {
			// Insert new record
			await pool.query(
				`
        INSERT INTO lab_scores (user_id, lab_id, level, score, solved, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
				[user.user_id, lab_id, level, score, solved, new Date()]
			);
			console.log("[LAB_SCORE_UPDATE] Inserted new record");
		}

		console.log("[LAB_SCORE_UPDATE] Database operation completed successfully");

		return NextResponse.json(
			{
				success: true,
				message: "Lab score updated successfully",
			},
			{
				headers: corsHeaders,
			}
		);
	} catch (error) {
		console.error("[LAB_SCORE_UPDATE] Error updating lab score:", error);
		console.error(
			"[LAB_SCORE_UPDATE] Error stack:",
			error instanceof Error ? error.stack : "No stack trace"
		);
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500, headers: corsHeaders }
		);
	}
}

import { Pool } from "pg";

/**
 * Centralized database configuration
 * All API routes should import pool from this file to ensure consistency
 */
export const pool = new Pool({
	host: process.env.PGHOST,
	port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
	user: process.env.PGUSER,
	password: process.env.PGPASSWORD,
	database: process.env.PGDATABASE,
});

/**
 * Test database connection
 */
export async function testConnection() {
	try {
		const client = await pool.connect();
		await client.query("SELECT NOW()");
		client.release();
		return true;
	} catch (error) {
		console.error("Database connection failed:", error);
		return false;
	}
}

export async function getUserById(
	userId: string
): Promise<{ user_id: string; name: string } | null> {
	const result = await pool.query(
		"SELECT user_id, name FROM users WHERE user_id = $1",
		[userId]
	);
	if (result.rows.length > 0) {
		return result.rows[0];
	}
	return null;
}

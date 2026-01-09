import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'letushack_db',
});

export async function GET(req: NextRequest) {
  try {
    // Query to get leaderboard data by joining users and lab_scores tables
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        COALESCE(SUM(ls.score), 0) as total_score,
        COUNT(CASE WHEN ls.solved = TRUE THEN 1 END) as challenges_solved
      FROM users u
      LEFT JOIN lab_scores ls ON u.user_id = ls.user_id
      GROUP BY u.user_id, u.name
      ORDER BY total_score DESC, challenges_solved DESC, u.name ASC
    `);

    // Add rank to each user (1-based index)
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      name: row.name || 'Anonymous',
      total_score: parseInt(row.total_score) || 0,
      challenges_solved: parseInt(row.challenges_solved) || 0
    }));

    return NextResponse.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length
    }, { status: 200 });
  } catch (err: any) {
    console.error('[LEADERBOARD_ERROR]', err);
    return NextResponse.json({
      error: true,
      message: 'Failed to fetch leaderboard data',
      details: err.message
    }, { status: 500 });
  }
}

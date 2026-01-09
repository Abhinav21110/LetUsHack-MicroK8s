import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAuthUser } from '@/lib/auth';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'letushack_db',
});

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    
    if (!user) {
      return NextResponse.json({
        error: true,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    // Get all lab scores for the user with lab details
    const result = await pool.query(`
      SELECT 
        ls.score_id,
        ls.lab_id,
        ls.level,
        ls.score,
        ls.solved,
        ls.submitted_at,
        l.lab_name,
        l.max_score,
        l.level as lab_difficulty
      FROM lab_scores ls
      JOIN labs l ON ls.lab_id = l.lab_id
      WHERE ls.user_id = $1
      ORDER BY ls.submitted_at DESC
    `, [user.user_id]);

    // Get user's total stats
    const statsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(score), 0) as total_score,
        COUNT(CASE WHEN solved = TRUE THEN 1 END) as challenges_solved,
        COUNT(*) as challenges_attempted
      FROM lab_scores
      WHERE user_id = $1
    `, [user.user_id]);

    const stats = statsResult.rows[0];

    return NextResponse.json({
      success: true,
      lab_scores: result.rows,
      stats: {
        total_score: parseInt(stats.total_score),
        challenges_solved: parseInt(stats.challenges_solved),
        challenges_attempted: parseInt(stats.challenges_attempted)
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('[LAB_SCORES_GET_ERROR]', err);
    return NextResponse.json({
      error: true,
      message: 'Failed to fetch lab scores'
    }, { status: 500 });
  }
}

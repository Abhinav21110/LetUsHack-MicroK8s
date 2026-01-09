import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAuthUser } from '@/lib/auth';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: 'letushack_db',
});

async function isAdmin(request: NextRequest): Promise<boolean> {
  const user = await getAuthUser(request);
  if (!user) return false;

  const result = await pool.query(
    'SELECT role FROM users WHERE user_id = $1',
    [user.user_id]
  );

  return result.rows[0]?.role === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const result = await pool.query(`
      SELECT 
        l.lab_id as id,
        l.lab_name,
        COALESCE(SPLIT_PART(l.lab_tags[1], '-', 1), 'General') as category,
        CASE 
          WHEN l.level <= 2 THEN 'easy'
          WHEN l.level <= 4 THEN 'medium'
          ELSE 'hard'
        END as difficulty,
        COALESCE(ls.is_enabled, true) as is_enabled,
        COALESCE(ls.max_concurrent_users, 100) as max_concurrent_users
      FROM labs l
      LEFT JOIN lab_settings ls ON l.lab_id = ls.lab_id
      ORDER BY l.lab_name
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching labs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: 'letushack_db'
});

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        l.lab_id,
        l.lab_name,
        l.lab_description,
        l.lab_tags,
        l.level,
        l.max_score,
        l.created_at,
        l.updated_at,
        COALESCE(ls.is_enabled, true) as is_enabled
      FROM labs l
      LEFT JOIN lab_settings ls ON l.lab_id = ls.lab_id
      WHERE COALESCE(ls.is_enabled, true) = true
      ORDER BY l.level ASC, l.created_at DESC
    `);

    return NextResponse.json({
      success: true,
      labs: result.rows
    });
  } catch (error) {
    console.error('Error fetching labs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch labs' },
      { status: 500 }
    );
  }
}

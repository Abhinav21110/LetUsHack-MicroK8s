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

// Check if user is admin
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
        id, 
        user_id, 
        name, 
        role, 
        created_at, 
        last_activity,
        ip_address
      FROM users 
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

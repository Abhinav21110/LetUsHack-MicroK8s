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

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or role' },
        { status: 400 }
      );
    }

    if (!['student', 'instructor', 'admin'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    await pool.query(
      'UPDATE users SET role = $1 WHERE user_id = $2',
      [role, userId]
    );

    // Log the action
    const adminUser = await getAuthUser(request);
    await pool.query(
      `INSERT INTO audit_log (admin_user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminUser?.user_id,
        'UPDATE_USER_ROLE',
        'user',
        userId,
        JSON.stringify({ newRole: role }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'User role updated successfully',
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

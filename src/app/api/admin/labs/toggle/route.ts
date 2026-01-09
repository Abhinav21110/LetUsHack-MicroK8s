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

    const { labId, isEnabled } = await request.json();

    if (!labId || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing labId or isEnabled' },
        { status: 400 }
      );
    }

    const adminUser = await getAuthUser(request);

    // Upsert lab_settings
    await pool.query(
      `INSERT INTO lab_settings (lab_id, is_enabled, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (lab_id) 
       DO UPDATE SET is_enabled = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP`,
      [labId, isEnabled, adminUser?.user_id]
    );

    // Log the action
    await pool.query(
      `INSERT INTO audit_log (admin_user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminUser?.user_id,
        'TOGGLE_LAB_STATUS',
        'lab',
        labId.toString(),
        JSON.stringify({ isEnabled }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Lab ${isEnabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling lab status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

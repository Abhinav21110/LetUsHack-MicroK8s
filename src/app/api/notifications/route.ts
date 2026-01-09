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

// GET - Fetch user notifications
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    
    if (!user) {
      return NextResponse.json({
        error: true,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const result = await pool.query(`
      SELECT id, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [user.user_id]);

    return NextResponse.json({
      success: true,
      notifications: result.rows,
      unread_count: result.rows.filter((n: any) => !n.is_read).length
    }, { status: 200 });
  } catch (err: any) {
    console.error('[NOTIFICATIONS_GET_ERROR]', err);
    return NextResponse.json({
      error: true,
      message: 'Failed to fetch notifications'
    }, { status: 500 });
  }
}

// POST - Mark notifications as read
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    
    if (!user) {
      return NextResponse.json({
        error: true,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await req.json();
    const { notification_ids } = body;

    if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      await pool.query(`
        UPDATE notifications
        SET is_read = true
        WHERE id = ANY($1) AND user_id = $2
      `, [notification_ids, user.user_id]);
    } else {
      // Mark all notifications as read
      await pool.query(`
        UPDATE notifications
        SET is_read = true
        WHERE user_id = $1 AND is_read = false
      `, [user.user_id]);
    }

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read'
    }, { status: 200 });
  } catch (err: any) {
    console.error('[NOTIFICATIONS_POST_ERROR]', err);
    return NextResponse.json({
      error: true,
      message: 'Failed to update notifications'
    }, { status: 500 });
  }
}

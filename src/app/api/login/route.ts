/* AUTH_LOCAL_POSTGRES (LOGIN) - TEMPORARY
   ROLLBACK_INSTRUCTIONS: When restoring Supabase/StackAuth, revert to original login handler and remove this file. */
// LOCAL_JWT_AUTH_TEMP (for local testing)
// ROLLBACK_INSTRUCTIONS: Remove or comment this module and re-enable supabase/session code.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { signToken, setAuthCookie } from '@/lib/auth';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'letushack_db',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, password } = body || {};

    if (!user_id || !password) {
      return NextResponse.json({ error: true, message: 'Missing required fields' }, { status: 400 });
    }

    const { rows } = await pool.query(
      'SELECT user_id, name, password_hash, role, ip_address, last_activity, created_at FROM users WHERE user_id = $1',
      [user_id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: true, message: 'Invalid credentials' }, { status: 401 });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ error: true, message: 'Invalid credentials' }, { status: 401 });
    }

    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) || req.headers.get('x-real-ip') || '';
    await pool.query('UPDATE users SET last_activity = NOW(), ip_address = $1 WHERE user_id = $2', [ip, user.user_id]);

    // Generate JWT token
    const token = await signToken({ user_id: user.user_id, name: user.name, role: user.role || 'student' });

    // K_LOG: signin
    console.log('[LOGIN]', {
      user_id,
      ip,
      at: new Date().toISOString(),
      tokenLength: token.length
    });

    // Return JSON instead of an absolute redirect. When login is called
    // via fetch, returning a redirect causes fetch to follow the
    // redirect URL which may point to a different hostname (e.g.
    // 'localhost') and trigger CORS errors when the page origin is a
    // LAN IP. Returning JSON avoids that and lets the client navigate.
    const response = NextResponse.json({ success: true, redirect: '/dashboard' }, { status: 200 });

    // Determine if the incoming request was over HTTPS and pass that
    // to the cookie setter so secure cookies are only used for https.
    const isHttps = new URL(req.url).protocol === 'https:';
    setAuthCookie(response, token, { secure: isHttps });

    return response;
  } catch (err: any) {
    console.error('[LOGIN_ERROR]', {
      error: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
      at: new Date().toISOString()
    });
    const msg = err?.message || 'Login failed';
    return NextResponse.json({ error: true, message: msg }, { status: 500 });
  }
}



/* AUTH_LOCAL_POSTGRES (REGISTER) - TEMPORARY
   ROLLBACK_INSTRUCTIONS: When restoring Supabase/StackAuth, revert to original register handler and remove this file. */
// LOCAL_JWT_AUTH_TEMP (for local testing)
// ROLLBACK_INSTRUCTIONS: Remove or comment this module and re-enable supabase/session code.

/* REGISTRATION_DISABLED
   Registration has been disabled for this environment. To rollback,
   restore the original implementation below by uncommenting it and
   removing this stub. The original implementation is preserved as a
   commented block at the end of this file.
*/

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: true, message: 'Registration is currently disabled' }, { status: 410 });
}

/*
Original implementation (commented out):

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

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(50) PRIMARY KEY,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      ip_address VARCHAR(255),
      last_activity TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  
  // Create points table with foreign key reference to users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS points (
      user_id VARCHAR(50) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
      xl1 INT DEFAULT 0,
      xl2 INT DEFAULT 0,
      xl3 INT DEFAULT 0,
      xl4 INT DEFAULT 0,
      xl5 INT DEFAULT 0,
      cl1 INT DEFAULT 0,
      cl2 INT DEFAULT 0,
      cl3 INT DEFAULT 0,
      cl4 INT DEFAULT 0,
      cl5 INT DEFAULT 0
    );
  `);
  
  // Create notifications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  `);
}

export async function POST(req: NextRequest) {
  try {
    await ensureUsersTable();
    const body = await req.json();
    const { user_id, password, name } = body || {};

    if (!user_id || !password) {
      return NextResponse.json({ error: true, message: 'Missing required fields' }, { status: 400 });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) || req.headers.get('x-real-ip') || '';

    const insertRes = await pool.query(
      `INSERT INTO users (user_id, password_hash, name, ip_address, last_activity)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING user_id, name, ip_address, last_activity, created_at`,
      [user_id, password_hash, name || null, ip]
    );

    const user = insertRes.rows[0];
    
    // Automatically create a points entry for the new user with all values set to 0
    await pool.query(
      `INSERT INTO points (user_id, xl1, xl2, xl3, xl4, xl5, cl1, cl2, cl3, cl4, cl5)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.user_id]
    );
    
    const token = await signToken({ user_id: user.user_id, name: user.name });

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', req.url), {
      status: 303  // See Other
    });
    
    // Determine if the incoming request was over HTTPS and pass that
    // to the cookie setter so secure cookies are only used for https.
    const isHttps = new URL(req.url).protocol === 'https:';
    setAuthCookie(response, token, { secure: isHttps });
    
    // Log the registration and cookie setting
    console.log('[REGISTER]', { 
      user_id, 
      ip,
      pointsCreated: true,
      at: new Date().toISOString() 
    });
    console.log('[COOKIE_SET_AFTER_REGISTER]', { 
      at: new Date().toISOString(),
      tokenLength: token.length
    });
    
    return response;
  } catch (err: any) {
    console.error('[REGISTER_ERROR]', {
      error: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
      at: new Date().toISOString()
    });
    const msg = err?.message || 'Registration failed';
    return NextResponse.json({ error: true, message: msg }, { status: 500 });
  }
}

*/



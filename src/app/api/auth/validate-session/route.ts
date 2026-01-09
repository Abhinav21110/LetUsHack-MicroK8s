// Internal API route for session validation
// Called by middleware to validate session tokens
// Runs in Node.js runtime (not Edge) so it can access database

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Verify this is an internal call (basic security measure)
    const isInternal = req.headers.get('x-internal-call') === 'true';
    if (!isInternal) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'unauthorized' 
      }, { status: 403 });
    }
    
    const body = await req.json();
    const { user_id, session_token } = body;
    
    if (!user_id || !session_token) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'missing_params' 
      }, { status: 400 });
    }
    
    // Query database for current session token
    const result = await pool.query(
      'SELECT session_token FROM users WHERE user_id = $1',
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'user_not_found' 
      }, { status: 200 });
    }
    
    const dbSessionToken = result.rows[0].session_token;
    
    // Check if tokens match
    if (session_token !== dbSessionToken) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'token_mismatch' 
      }, { status: 200 });
    }
    
    // Session is valid
    return NextResponse.json({ 
      valid: true 
    }, { status: 200 });
    
  } catch (error) {
    console.error('[VALIDATE_SESSION_ERROR]', error);
    return NextResponse.json({ 
      valid: false, 
      reason: 'internal_error' 
    }, { status: 500 });
  }
}

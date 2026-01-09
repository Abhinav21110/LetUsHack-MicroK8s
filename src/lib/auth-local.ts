/* LOCAL_JWT_AUTH_TEMP (for local testing)
   ROLLBACK_INSTRUCTIONS: Remove or comment this module and re-enable supabase/session code. */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET_LOCAL || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '24h';

export function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken<T = any>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}



// AUTH_RESTRICTION_REENABLED
// Logout endpoint that clears the auth cookie and redirects to login

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Create a JSON response instead of redirecting. Returning a
  // redirect here causes fetch to follow an absolute redirect URL
  // (which may point at 'localhost' vs the LAN IP) and triggers
  // CORS issues. Respond with JSON and let the client navigate.
  const response = NextResponse.json({ success: true, redirect: '/login' }, { status: 200 });

  // Clear the auth cookie
  clearAuthCookie(response);

  // Log the logout action
  console.log('[LOGOUT]', { at: new Date().toISOString() });

  return response;
}

// Also handle GET requests for direct navigation
export async function GET(req: NextRequest) {
  // For GET we also return JSON; clients can choose to follow the
  // redirect URL in the JSON payload if they are using fetch. If the
  // request is a direct browser navigation to this endpoint, the
  // JSON will be shown — this endpoint is primarily for XHR logout.
  return POST(req);
}
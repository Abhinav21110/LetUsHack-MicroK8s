/**
 * Rate Limiting Utility
 * Implements sliding window rate limiting for API endpoints
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Get client identifier from request
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get IP from headers (for reverse proxy scenarios)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  return ip;
}

/**
 * Rate limit a request
 * @param req - The NextRequest object
 * @param identifier - Unique identifier for the rate limit (e.g., 'login', 'register')
 * @param config - Rate limit configuration
 * @returns Object indicating if request is allowed and remaining attempts
 */
export function rateLimit(
  req: NextRequest,
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const clientId = getClientIdentifier(req);
  const key = `${clientId}_${identifier}`;

  const record = rateLimitStore.get(key);

  // No existing record or window has expired
  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetTime,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Pre-configured rate limiters for common endpoints
 */
export const RateLimiters = {
  /**
   * Login endpoint: 5 attempts per 15 minutes
   */
  login: (req: NextRequest) =>
    rateLimit(req, 'login', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    }),

  /**
   * Registration endpoint: 3 attempts per hour
   */
  register: (req: NextRequest) =>
    rateLimit(req, 'register', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
    }),

  /**
   * Lab start endpoint: 10 attempts per hour
   */
  labStart: (req: NextRequest) =>
    rateLimit(req, 'lab_start', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
    }),

  /**
   * Score update endpoint: 20 attempts per minute
   */
  scoreUpdate: (req: NextRequest) =>
    rateLimit(req, 'score_update', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
    }),

  /**
   * Generic API: 60 requests per minute
   */
  api: (req: NextRequest) =>
    rateLimit(req, 'api', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
    }),
};

/**
 * Format reset time for Retry-After header
 */
export function getRetryAfterSeconds(resetTime: number): number {
  const now = Date.now();
  return Math.ceil((resetTime - now) / 1000);
}

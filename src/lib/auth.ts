// src/lib/auth.ts  (shared by all Vercel API routes)
// ═══════════════════════════════════════════════════════════════════════════════
// Verifies the Privy JWT from the Authorization header.
// Returns the Privy user ID if valid, throws if not.
//
// Usage in any API route:
//   const userId = await requireAuth(request);
// ═══════════════════════════════════════════════════════════════════════════════

import { log, warn, error as logError } from '../utils/logger';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

interface PrivyTokenClaims {
  userId: string;       // Privy user ID (did:privy:...)
  appId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

/**
 * Verifies the Privy JWT in the Authorization header.
 * Returns the Privy user ID on success, throws on failure.
 */
export async function requireAuth(request: Request): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    // Verify using Privy's verification endpoint
    // This is the simplest approach — no need to verify JWT locally
    const response = await fetch('https://auth.privy.io/api/v1/sessions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'privy-app-id': PRIVY_APP_ID,
        'privy-app-secret': PRIVY_APP_SECRET,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new AuthError('Invalid or expired token', 401);
    }

    const data = await response.json();
    const userId = data.user_id || data.userId;

    if (!userId) {
      throw new AuthError('Could not extract user ID from token', 401);
    }

    return userId;
  } catch (err: any) {
    if (err instanceof AuthError) throw err;
    logError('[AUTH] Token verification failed:', err);
    throw new AuthError('Token verification failed', 401);
  }
}

/**
 * Optional auth — returns userId if authenticated, null if not.
 * Use for routes that work for both authed and unauthed users.
 */
export async function optionalAuth(request: Request): Promise<string | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

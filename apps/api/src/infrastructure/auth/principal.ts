import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export interface AuthenticatedPrincipal {
  userId: string;
  role: 'user' | 'admin' | 'system';
  issuedAt: number;
  expiresAt: number;
  jti?: string;
  type?: 'access' | 'refresh';
}

/**
 * Creates a cryptographically signed principal token using HMAC-SHA256 and JWT_SECRET.
 * Token Format: <payload_base64url>.<signature_base64url>
 */
export function createSignedPrincipalToken(
  userId: string,
  role: 'user' | 'admin' | 'system' = 'user',
  ttlMs: number = 86400000, // 24 hours
  type: 'access' | 'refresh' = 'access',
  jti: string = crypto.randomUUID()
): string {
  const now = Date.now();
  const payload: AuthenticatedPrincipal = {
    userId,
    role,
    issuedAt: now,
    expiresAt: now + ttlMs,
    jti,
    type
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
  hmac.update(payloadB64);
  const signatureB64 = hmac.digest('base64url');
  return `${payloadB64}.${signatureB64}`;
}

/**
 * Generates an HMAC-SHA256 signature for a (userId + role) payload using JWT_SECRET.
 */
export function signUserId(userId: string, role: string = 'user'): string {
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
  hmac.update(`${userId}:${role}`);
  return hmac.digest('base64url');
}

/**
 * Verifies a cryptographically signed principal token.
 * Returns the AuthenticatedPrincipal payload if valid and unexpired; otherwise returns null.
 */
export function verifySignedPrincipalToken(
  token: string,
  expectedType?: 'access' | 'refresh'
): AuthenticatedPrincipal | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;
  try {
    const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
    hmac.update(payloadB64);
    const expectedSignatureB64 = hmac.digest('base64url');

    const sigBuf = Buffer.from(signatureB64);
    const expectedBuf = Buffer.from(expectedSignatureB64);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload: AuthenticatedPrincipal = JSON.parse(payloadStr);

    if (!payload.userId || !payload.role || !payload.expiresAt) return null;
    if (Date.now() > payload.expiresAt) return null;
    if (expectedType && payload.type && payload.type !== expectedType) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Helper to generate HTTP request headers containing a valid signed authorization token.
 */
export function createAuthHeaders(userId: string, role: 'user' | 'admin' | 'system' = 'user'): Record<string, string> {
  const token = createSignedPrincipalToken(userId, role);
  return {
    'authorization': `Bearer ${token}`,
    'x-user-id': userId
  };
}

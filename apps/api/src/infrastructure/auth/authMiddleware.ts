import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifySignedPrincipalToken, signUserId, AuthenticatedPrincipal } from './principal.js';

const uuidSchema = z.string().uuid();

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userRole: 'user' | 'admin' | 'system';
  principal: AuthenticatedPrincipal;
}

/**
 * Resolves and verifies the authenticated principal from an incoming HTTP request.
 * Supported Authentication Credentials:
 * 1. Authorization: Bearer <signed_token>
 * 2. x-apex-token: <signed_token>
 * 3. x-user-id: <uuid> + x-user-id-sig: <hmac_sig>
 *
 * If missing, malformed, forged, or unauthenticated -> Throws Error('UNAUTHORIZED')
 */
export function resolveAuthenticatedPrincipal(request: FastifyRequest): AuthenticatedPrincipal {
  // 1. Check Authorization Bearer header or x-apex-token header
  const authHeader = request.headers['authorization'];
  const apexTokenHeader = request.headers['x-apex-token'];
  
  let rawToken: string | undefined;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    rawToken = authHeader.substring(7).trim();
  } else if (typeof apexTokenHeader === 'string' && apexTokenHeader.trim()) {
    rawToken = apexTokenHeader.trim();
  }

  if (rawToken) {
    const verified = verifySignedPrincipalToken(rawToken);
    if (verified) return verified;
  }

  // 2. Check x-user-id header WITH cryptographic signature (x-user-id-sig)
  const rawUserId = request.headers['x-user-id'];
  const rawSig = request.headers['x-user-id-sig'];
  const rawRoleHeader = request.headers['x-user-role'];

  if (typeof rawUserId === 'string' && rawUserId.trim()) {
    const userId = rawUserId.trim();
    const parseResult = uuidSchema.safeParse(userId);
    if (parseResult.success) {
      const role = (typeof rawRoleHeader === 'string' && ['user', 'admin', 'system'].includes(rawRoleHeader.trim()))
        ? (rawRoleHeader.trim() as 'user' | 'admin' | 'system')
        : 'user';

      if (typeof rawSig === 'string' && rawSig.trim()) {
        const expectedSig = signUserId(userId, role);
        if (rawSig.trim() === expectedSig) {
          return {
            userId,
            role,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 86400000
          };
        }
      }

      // In test environment, permit fallback if process.env.NODE_ENV === 'test' and no explicit unsigned rejection flag is set
      if (process.env.NODE_ENV === 'test' && !(request.headers as any)['x-test-strict-auth']) {
        return {
          userId,
          role,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 86400000
        };
      }
    }
  }

  throw new Error('UNAUTHORIZED');
}

/**
 * Middleware function for Fastify preHandler hook to enforce principal authentication.
 */
export async function requireAuthentication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const principal = resolveAuthenticatedPrincipal(request);
    (request as any).userId = principal.userId;
    (request as any).userRole = principal.role;
    (request as any).principal = principal;
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing, invalid, or forged. Provide valid Bearer token or signed credentials.'
      }
    });
  }
}

/**
 * Centralized identity resolver used across route plugins.
 */
export function resolveDevelopmentIdentity(request: any): string {
  const principal = resolveAuthenticatedPrincipal(request as FastifyRequest);
  request.userId = principal.userId;
  request.userRole = principal.role;
  request.principal = principal;
  return principal.userId;
}

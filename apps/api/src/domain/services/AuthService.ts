import { createSignedPrincipalToken, verifySignedPrincipalToken, AuthenticatedPrincipal } from '../../infrastructure/auth/principal.js';
import crypto from 'node:crypto';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

/**
 * Interface for token revocation storage.
 * Production requires a shared external state store (e.g. Redis).
 * Development and testing use the in-memory fallback.
 */
export interface ITokenRevocationStore {
  isRevoked(tokenId: string): Promise<boolean>;
  revokeToken(tokenId: string, ttlMs?: number): Promise<void>;
}

export class InMemoryTokenRevocationStore implements ITokenRevocationStore {
  private revokedTokens = new Map<string, number>();

  async isRevoked(tokenId: string): Promise<boolean> {
    const expiresAt = this.revokedTokens.get(tokenId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.revokedTokens.delete(tokenId);
      return false;
    }
    return true;
  }

  async revokeToken(tokenId: string, ttlMs: number = 86400000): Promise<void> {
    this.revokedTokens.set(tokenId, Date.now() + ttlMs);
  }
}

export class RedisTokenRevocationStore implements ITokenRevocationStore {
  private redis: Redis;

  constructor(redisUrlOrInstance: string | Redis) {
    if (typeof redisUrlOrInstance === 'string') {
      this.redis = new Redis(redisUrlOrInstance, {
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });
    } else {
      this.redis = redisUrlOrInstance;
    }
  }

  async isRevoked(tokenId: string): Promise<boolean> {
    try {
      const exists = await this.redis.get(`revoked:${tokenId}`);
      return exists !== null;
    } catch (err) {
      throw new Error(`REDIS_REVOCATION_STORE_ERROR: Failed to check token revocation status`);
    }
  }

  async revokeToken(tokenId: string, ttlMs: number = 86400000): Promise<void> {
    try {
      await this.redis.set(`revoked:${tokenId}`, '1', 'PX', ttlMs);
    } catch (err) {
      throw new Error(`REDIS_REVOCATION_STORE_ERROR: Failed to record token revocation`);
    }
  }
}

export function createRevocationStore(overrideEnv?: string, redisUrlOverride?: string): ITokenRevocationStore {
  const targetEnv = overrideEnv || env.NODE_ENV;
  const redisUrl = redisUrlOverride || env.REDIS_URL;

  if (targetEnv === 'production') {
    if (!redisUrl || redisUrl.trim() === '') {
      throw new Error('FATAL: Production mode requires a valid REDIS_URL for shared external token revocation storage.');
    }
    return new RedisTokenRevocationStore(redisUrl);
  }

  if (redisUrl && redisUrl.trim() !== '') {
    return new RedisTokenRevocationStore(redisUrl);
  }

  return new InMemoryTokenRevocationStore();
}

export const globalRevocationStore: ITokenRevocationStore = createRevocationStore();

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  principal: AuthenticatedPrincipal;
}

export class AuthService {
  constructor(private revocationStore: ITokenRevocationStore = globalRevocationStore) {}

  async login(userId: string, role: 'user' | 'admin' | 'system' = 'user'): Promise<LoginResult> {
    const accessToken = createSignedPrincipalToken(userId, role, 900000, 'access'); // 15 minutes
    const refreshToken = createSignedPrincipalToken(userId, role, 604800000, 'refresh'); // 7 days
    const principal = verifySignedPrincipalToken(accessToken, 'access')!;

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      principal
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const principal = verifySignedPrincipalToken(refreshToken, 'refresh');
    if (!principal) {
      throw new Error('INVALID_TOKEN');
    }

    const tokenId = principal.jti || crypto.createHash('sha256').update(refreshToken).digest('hex');
    const hashId = crypto.createHash('sha256').update(refreshToken).digest('hex');

    if (await this.revocationStore.isRevoked(tokenId) || await this.revocationStore.isRevoked(hashId)) {
      throw new Error('TOKEN_REVOKED');
    }

    // Refresh Token Rotation: Revoke old refresh token upon use
    const ttlMsRemaining = Math.max(1000, principal.expiresAt - Date.now());
    await this.revocationStore.revokeToken(tokenId, ttlMsRemaining);
    await this.revocationStore.revokeToken(hashId, ttlMsRemaining);

    // Issue new token pair
    return this.login(principal.userId, principal.role);
  }

  async revoke(token: string): Promise<void> {
    const principal = verifySignedPrincipalToken(token);
    const hashId = crypto.createHash('sha256').update(token).digest('hex');
    await this.revocationStore.revokeToken(hashId);
    if (principal?.jti) {
      await this.revocationStore.revokeToken(principal.jti);
    }
  }
}

export const authService = new AuthService();

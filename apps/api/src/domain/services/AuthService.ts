import { createSignedPrincipalToken, verifySignedPrincipalToken, AuthenticatedPrincipal } from '../../infrastructure/auth/principal.js';
import crypto from 'node:crypto';

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

export const globalRevocationStore: ITokenRevocationStore = new InMemoryTokenRevocationStore();

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  principal: AuthenticatedPrincipal;
}

export class AuthService {
  constructor(private revocationStore: ITokenRevocationStore = globalRevocationStore) {}

  async login(userId: string, role: 'user' | 'admin' | 'system' = 'user'): Promise<LoginResult> {
    const accessToken = createSignedPrincipalToken(userId, role, 900000); // 15 minutes
    const refreshToken = createSignedPrincipalToken(userId, role, 604800000); // 7 days
    const principal = verifySignedPrincipalToken(accessToken)!;

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      principal
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const tokenId = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (await this.revocationStore.isRevoked(tokenId)) {
      throw new Error('TOKEN_REVOKED');
    }

    const principal = verifySignedPrincipalToken(refreshToken);
    if (!principal) {
      throw new Error('INVALID_TOKEN');
    }

    // Issue new token pair
    return this.login(principal.userId, principal.role);
  }

  async revoke(token: string): Promise<void> {
    const tokenId = crypto.createHash('sha256').update(token).digest('hex');
    await this.revocationStore.revokeToken(tokenId);
  }
}

export const authService = new AuthService();

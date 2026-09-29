import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { AuthService, InMemoryTokenRevocationStore } from '../domain/services/AuthService.js';
import { verifySignedPrincipalToken, createSignedPrincipalToken } from '../infrastructure/auth/principal.js';

describe('Phase 20 — Authentication Lifecycle & Token Management Suite', () => {
  const app = buildApp();
  const testUserId = '00000000-0000-4000-a000-000000000001';

  it('1. AuthService issues valid access and refresh tokens', async () => {
    const store = new InMemoryTokenRevocationStore();
    const service = new AuthService(store);

    const result = await service.login(testUserId, 'user');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);

    const verified = verifySignedPrincipalToken(result.accessToken);
    expect(verified?.userId).toBe(testUserId);
    expect(verified?.role).toBe('user');
  });

  it('2. AuthService handles refresh token lifecycle and token revocation', async () => {
    const store = new InMemoryTokenRevocationStore();
    const service = new AuthService(store);

    const loginResult = await service.login(testUserId, 'user');
    const refreshResult = await service.refresh(loginResult.refreshToken);
    expect(refreshResult.accessToken).toBeDefined();

    // Revoke refresh token
    await service.revoke(loginResult.refreshToken);

    // Refresh should fail after revocation
    await expect(service.refresh(loginResult.refreshToken)).rejects.toThrow('TOKEN_REVOKED');
  });

  it('3. HTTP API POST /api/v1/auth/login generates valid token response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        userId: testUserId,
        role: 'user'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
  });

  it('4. HTTP API POST /api/v1/auth/refresh and /revoke endpoint workflow', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        userId: testUserId,
        role: 'admin'
      }
    });
    const { refreshToken } = JSON.parse(loginRes.body).data;

    // Refresh token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(JSON.parse(refreshRes.body).data.accessToken).toBeDefined();

    // Revoke token
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/revoke',
      payload: { token: refreshToken }
    });
    expect(revokeRes.statusCode).toBe(200);
    expect(JSON.parse(revokeRes.body).data.revoked).toBe(true);

    // Subsequent refresh fails
    const failedRefreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken }
    });
    expect(failedRefreshRes.statusCode).toBe(401);
  });

  it('5. HTTP API POST /api/v1/auth/onboard requires administrative authorization', async () => {
    // Unauthenticated request
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard',
      payload: {
        userId: '00000000-0000-4000-a000-000000000002',
        email: 'user@apex.os',
        role: 'user'
      }
    });
    expect(unauthRes.statusCode).toBe(401);

    // Regular user request (forbidden)
    const userToken = createSignedPrincipalToken(testUserId, 'user');
    const forbiddenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard',
      headers: {
        authorization: `Bearer ${userToken}`
      },
      payload: {
        userId: '00000000-0000-4000-a000-000000000002',
        email: 'user@apex.os',
        role: 'user'
      }
    });
    expect(forbiddenRes.statusCode).toBe(403);

    // Admin request (success)
    const adminToken = createSignedPrincipalToken(testUserId, 'admin');
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard',
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        userId: '00000000-0000-4000-a000-000000000002',
        email: 'newuser@apex.os',
        role: 'user'
      }
    });
    expect(adminRes.statusCode).toBe(201);
    expect(JSON.parse(adminRes.body).data.status).toBe('ACTIVE');
  });

  it('6. createRevocationStore enforces production fail-fast when REDIS_URL is absent', () => {
    import('../domain/services/AuthService.js').then(({ createRevocationStore }) => {
      expect(() => createRevocationStore('production', '')).toThrow(/Production mode requires a valid REDIS_URL/);
    });
  });

  it('7. Shared revocation store contract prevents token usage across multi-instance nodes', async () => {
    const { AuthService, InMemoryTokenRevocationStore } = await import('../domain/services/AuthService.js');
    
    // Shared store instance representing external Redis / key-value store
    const sharedStore = new InMemoryTokenRevocationStore();

    // Instance A and Instance B share the external store
    const instanceA = new AuthService(sharedStore);
    const instanceB = new AuthService(sharedStore);

    const loginResult = await instanceA.login(testUserId, 'user');
    
    // Instance A revokes the refresh token
    await instanceA.revoke(loginResult.refreshToken);

    // Instance B attempts to use the revoked refresh token -> fails
    await expect(instanceB.refresh(loginResult.refreshToken)).rejects.toThrow('TOKEN_REVOKED');
  });
});

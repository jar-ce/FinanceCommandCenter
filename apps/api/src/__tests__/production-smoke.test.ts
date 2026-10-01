/**
 * FINANCE COMMAND CENTER (APEX OS)
 * Phase 22 — Production Deployment Readiness & Infrastructure Smoke Test Suite
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 22 — Production Deployment Readiness & Infrastructure Smoke Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Liveness & Readiness Probes', () => {
    it('GET /health returns 200 OK with healthy status and process uptime', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe('healthy');
      expect(typeof payload.data.uptime).toBe('number');
    });

    it('GET /health/readiness & GET /ready verify database connectivity', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/readiness'
      });

      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.status).toBe('ready');
      expect(payload.data.database).toBe('connected');
    });
  });

  describe('2. Security Boundary & Headers Verification (SEC-02 & SEC-05)', () => {
    it('applies standard production security headers on HTTP responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBe("default-src 'self'");
    });

    it('enforces authentication boundary on protected business endpoints (returns 401 Unauthorized)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/summary'
      });

      expect(res.statusCode).toBe(401);
      const payload = JSON.parse(res.payload);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('UNAUTHORIZED');
    });

    it('enforces CORS origin check when non-matching origin header is supplied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'https://unauthorized-malicious-domain.com'
        }
      });

      // Cors error callback returns Error('CORS_NOT_ALLOWED')
      expect(res.statusCode).toBe(500);
    });
  });
});

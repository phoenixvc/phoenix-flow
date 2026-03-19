import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyMystiraJwt } from './auth.js';

const HS256_SECRET = 'DevSecret-StableKey-ForLocalDevelopmentOnly-2024';
const ISSUER = 'mystira-identity-api';
const AUDIENCE = 'mystira-platform';

function makeToken(payload: object, secret = HS256_SECRET, opts: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: '1h',
    algorithm: 'HS256',
    ...opts,
  });
}

function mockReq(authorization?: string): Partial<Request> {
  return { headers: authorization ? { authorization } : {} } as Partial<Request>;
}

function mockRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; _status: number } {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('verifyMystiraJwt', () => {
  const next = vi.fn() as unknown as NextFunction;

  beforeEach(() => vi.clearAllMocks());

  it('1. passes with valid HS256 token and populates req.user', () => {
    const token = makeToken({ sub: 'user-123', email: 'a@b.com', role: 'user' });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user.sub).toBe('user-123');
    expect((req as any).user.email).toBe('a@b.com');
  });

  it('2. rejects missing Authorization header with 401', () => {
    const req = mockReq();
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
  });

  it('3. rejects non-Bearer Authorization with 401', () => {
    const req = mockReq('Basic sometoken');
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('4. rejects expired token with 401 "Token expired"', () => {
    const token = makeToken({ sub: 'user-123' }, HS256_SECRET, { expiresIn: -1 });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('5. rejects token signed with wrong secret', () => {
    const token = makeToken({ sub: 'user-123' }, 'wrong-secret');
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('6. passes with RS256 PEM token when MYSTIRA_JWT_PUBLIC_KEY is set', () => {
    // Generate RSA key pair inline for the test
    const { generateKeyPairSync } = require('crypto');
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    const token = jwt.sign({ sub: 'user-rs256', email: 'rs@test.com' }, privatePem, {
      algorithm: 'RS256',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    // Temporarily override config
    const configModule = require('../config.js');
    const original = configModule.config.mystira.jwtPublicKey;
    configModule.config.mystira.jwtPublicKey = publicPem;
    configModule.config.mystira.jwtSecret = undefined;

    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();

    verifyMystiraJwt(req as Request, res as unknown as Response, next);

    configModule.config.mystira.jwtPublicKey = original;

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user.sub).toBe('user-rs256');
  });
});

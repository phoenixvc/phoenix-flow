import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config.js';

export interface MystiraClaims {
  sub: string;
  account_id?: string;
  email?: string;
  name?: string;
  role?: string;
  auth_provider?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: MystiraClaims;
    }
  }
}

function getVerifyKey(): { secret: string } | { publicKey: string } {
  if (config.mystira.jwtPublicKey) return { publicKey: config.mystira.jwtPublicKey };
  if (config.mystira.jwtSecret) return { secret: config.mystira.jwtSecret };
  throw new Error('No JWT verification key configured');
}

export function verifyMystiraJwt(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = auth.slice(7);
  const key = getVerifyKey();

  try {
    const payload = jwt.verify(token, 'publicKey' in key ? key.publicKey : key.secret, {
      issuer: config.mystira.issuer,
      audience: config.mystira.audience,
      algorithms: 'publicKey' in key ? ['RS256'] : ['HS256'],
    }) as JwtPayload;

    req.user = {
      sub: payload.sub as string,
      account_id: payload['account_id'],
      email: payload['email'],
      name: payload['name'],
      role: payload['role'],
      auth_provider: payload['auth_provider'],
    };

    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    const msg = isExpired ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: msg });
  }
}

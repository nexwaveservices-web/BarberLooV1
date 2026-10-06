import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://ddusvfylhifoniobzmcq.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_bUpxVfRsVPz_d0qg1QrrNA_m7zM66t6';

export const OWNER_ADMIN_EMAIL = 'nexwaveservices@gmail.com';

const supaAuthVerifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  'barberloo-production-secure-hmac-key-2026-auth';

export interface DecodedUserToken {
  uid: string;
  email?: string;
  name?: string;
  role?: 'customer' | 'barber' | 'shop_owner' | 'admin';
}

export interface AuthRequest extends Request {
  user?: DecodedUserToken;
}

export function createSignedToken(payload: {
  uid: string;
  email: string;
  role?: string;
  name?: string;
}): string {
  const cleanEmail = String(payload.email || '').trim().toLowerCase();
  const resolvedRole =
    cleanEmail === OWNER_ADMIN_EMAIL
      ? 'admin'
      : (payload.role as any) || 'customer';

  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30-day session
  const body = Buffer.from(
    JSON.stringify({
      uid: payload.uid,
      email: cleanEmail,
      role: resolvedRole,
      name: payload.name || cleanEmail.split('@')[0],
      iat: Math.floor(Date.now() / 1000),
      exp,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export async function verifyAuthToken(
  token: string
): Promise<DecodedUserToken | null> {
  if (!token || typeof token !== 'string') return null;

  // 1. First, attempt verification of server-signed HMAC JWT
  const parts = token.split('.');
  if (parts.length === 3) {
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (sig === expectedSig) {
      try {
        const payload = JSON.parse(
          Buffer.from(body, 'base64url').toString('utf8')
        );
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return null; // Expired
        }
        const cleanEmail = payload.email
          ? String(payload.email).toLowerCase()
          : undefined;
        const role =
          cleanEmail === OWNER_ADMIN_EMAIL
            ? 'admin'
            : payload.role || 'customer';
        return {
          uid: String(payload.uid),
          email: cleanEmail,
          name: payload.name,
          role,
        };
      } catch {
        // Fall through to Supabase check
      }
    }
  }

  // 2. Second, verify token cryptographically via Supabase Auth server
  try {
    const { data, error } = await supaAuthVerifier.auth.getUser(token);
    if (!error && data?.user) {
      const u = data.user;
      const cleanEmail = u.email?.toLowerCase();
      const role =
        cleanEmail === OWNER_ADMIN_EMAIL
          ? 'admin'
          : (u.user_metadata?.role as any) || 'customer';
      return {
        uid: u.id,
        email: cleanEmail,
        name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          cleanEmail?.split('@')[0],
        role,
      };
    }
  } catch {
    // Verification failed
  }

  return null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Missing or malformed authentication token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  const verified = await verifyAuthToken(token);
  if (!verified) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Invalid, tampered, or expired authentication token' });
  }

  req.user = verified;
  next();
};

export const requireBarberOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  const verified = await verifyAuthToken(token);
  if (!verified) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Invalid authentication token' });
  }

  req.user = verified;
  const isAuthorized =
    verified.role === 'barber' ||
    verified.role === 'shop_owner' ||
    verified.role === 'admin' ||
    verified.email?.toLowerCase() === OWNER_ADMIN_EMAIL;

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden: Salon Barber or Shop Owner credentials required',
    });
  }
  next();
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  const verified = await verifyAuthToken(token);
  if (!verified) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Invalid authentication token' });
  }

  req.user = verified;
  const isAdmin =
    verified.role === 'admin' ||
    verified.email?.toLowerCase() === OWNER_ADMIN_EMAIL;

  if (!isAdmin) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Platform Administrator privileges required' });
  }
  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    const verified = await verifyAuthToken(token);
    if (verified) {
      req.user = verified;
    }
  }
  next();
};

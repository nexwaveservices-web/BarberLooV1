import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://ddusvfylhifoniobzmcq.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_bUpxVfRsVPz_d0qg1QrrNA_m7zM66t6';

const supaAuthVerifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'barberloo-dev-secure-hmac-key-2026-auth');

export interface DecodedUserToken {
  uid: string;
  email?: string;
  name?: string;
  role: 'customer' | 'barber' | 'shop_owner' | 'admin';
  status?: 'active' | 'suspended';
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
  if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
    throw new Error('Fatal: AUTH_SECRET must be configured in production.');
  }
  const cleanEmail = String(payload.email || '').trim().toLowerCase();
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30-day session
  const body = Buffer.from(
    JSON.stringify({
      uid: payload.uid,
      email: cleanEmail,
      role: payload.role || 'customer',
      name: payload.name || cleanEmail.split('@')[0],
      iat: Math.floor(Date.now() / 1000),
      exp,
    })
  ).toString('base64url');

  const secretToUse = AUTH_SECRET || 'barberloo-dev-secure-hmac-key-2026-auth';
  const signature = crypto
    .createHmac('sha256', secretToUse)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export async function verifyAuthToken(
  token: string
): Promise<DecodedUserToken | null> {
  if (!token || typeof token !== 'string') return null;

  let verifiedUid: string | null = null;
  let verifiedEmail: string | undefined;
  let verifiedName: string | undefined;

  // 1. Check server-signed HMAC JWT
  const parts = token.split('.');
  if (parts.length === 3) {
    const [header, body, sig] = parts;
    const secretToUse = AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'barberloo-dev-secure-hmac-key-2026-auth');
    if (secretToUse) {
      const expectedSig = crypto
        .createHmac('sha256', secretToUse)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (sig === expectedSig) {
        try {
          const payload = JSON.parse(
            Buffer.from(body, 'base64url').toString('utf8')
          );
          if (!payload.exp || payload.exp >= Math.floor(Date.now() / 1000)) {
            verifiedUid = String(payload.uid);
            verifiedEmail = payload.email
              ? String(payload.email).toLowerCase()
              : undefined;
            verifiedName = payload.name;
          }
        } catch {
          // Fall through to Supabase check
        }
      }
    }
  }

  // 2. Cryptographically verify token via Supabase Auth server
  if (!verifiedUid) {
    try {
      const { data, error } = await supaAuthVerifier.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user;
        verifiedUid = u.id;
        verifiedEmail = u.email?.toLowerCase();
        verifiedName =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          verifiedEmail?.split('@')[0];
      }
    } catch {
      // Verification failed
    }
  }

  if (!verifiedUid) return null;

  // 3. Establish authoritative database profile & role (never trust client claims)
  try {
    const existingProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, verifiedUid))
      .limit(1);

    const userProfile = existingProfiles[0];
    if (userProfile) {
      return {
        uid: verifiedUid,
        email: verifiedEmail || userProfile.email,
        name: verifiedName || userProfile.name,
        role: (userProfile.role as any) || 'customer',
        status: (userProfile.status as any) || 'active',
      };
    }

    // Default un-synced authenticated user to customer
    return {
      uid: verifiedUid,
      email: verifiedEmail,
      name: verifiedName,
      role: 'customer',
      status: 'active',
    };
  } catch {
    return {
      uid: verifiedUid,
      email: verifiedEmail,
      name: verifiedName,
      role: 'customer',
      status: 'active',
    };
  }
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

  // Section 34: Block suspended accounts
  if (verified.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended: Your account is currently suspended. Please contact platform administration.',
    });
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

  if (verified.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended: Your account is currently suspended. Please contact platform administration.',
    });
  }

  req.user = verified;
  const isAuthorized =
    verified.role === 'barber' ||
    verified.role === 'shop_owner' ||
    verified.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden: Salon Barber, Shop Owner, or Admin role required',
    });
  }
  next();
};

export const requireShopOwnerOrAdmin = async (
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

  if (verified.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended: Your account is currently suspended. Please contact platform administration.',
    });
  }

  req.user = verified;
  const isAuthorized =
    verified.role === 'shop_owner' ||
    verified.role === 'admin';

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden: Salon Owner or Platform Administrator privileges required',
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

  if (verified.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended: Your account is currently suspended. Please contact platform administration.',
    });
  }

  req.user = verified;
  if (verified.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Forbidden: Platform Administrator role required' });
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

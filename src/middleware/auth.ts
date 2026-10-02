import { Request, Response, NextFunction } from 'express';

export interface DecodedUserToken {
  uid: string;
  email?: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: DecodedUserToken;
}

function decodeJwtPayload(token: string): DecodedUserToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const uid = payload.sub || payload.user_id || payload.uid;
    if (!uid) return null;
    return {
      uid: String(uid),
      email: payload.email ? String(payload.email) : undefined,
      name:
        payload.user_metadata?.full_name ||
        payload.user_metadata?.name ||
        payload.name ||
        undefined,
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = decodeJwtPayload(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  req.user = decoded;
  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
};

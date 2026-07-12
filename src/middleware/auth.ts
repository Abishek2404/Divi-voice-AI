import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
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
  
  // Custom Demo/Sandbox authentication bypass
  if (token && token.startsWith('demo_')) {
    const parts = token.split('_');
    const uid = parts[1] || 'demo-user-123';
    const email = parts[2] || 'demo@divi.com';
    req.user = {
      uid,
      email,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      aud: 'divi-ai-1d969',
      exp: Math.floor(Date.now() / 1000) + 36000,
      firebase: {
        identities: {},
        sign_in_provider: 'custom',
      },
      iss: 'https://securetoken.google.com/divi-ai-1d969',
      sub: uid,
    } as any;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error?.message || String(error));
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

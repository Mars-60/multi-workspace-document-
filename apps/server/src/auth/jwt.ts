import type { Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import env from '../config/env.js';

export const AUTH_COOKIE_NAME = 'mwda_session';
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type AuthTokenPayload = JwtPayload & {
  sub: string;
};

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  path: '/',
};

export function signAuthToken(userId: string) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: '7d',
  });
}

export function verifyAuthToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as AuthTokenPayload).sub !== 'string'
  ) {
    throw new Error('Invalid auth token');
  }

  return (payload as AuthTokenPayload).sub;
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
}

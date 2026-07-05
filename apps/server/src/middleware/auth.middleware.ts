import type { Request, Response, NextFunction } from 'express';

import { AUTH_COOKIE_NAME, verifyAuthToken } from '../auth/jwt.js';
import { prisma } from '../lib/prisma.js';

export type AuthenticatedRequest = Request & {
  user?: { id: string; email: string; name?: string | null };
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      return;
    }

    const userId = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      return;
    }

    (req as AuthenticatedRequest).user = user;

    next();
  } catch {
    res
      .status(401)
      .json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
  }
}

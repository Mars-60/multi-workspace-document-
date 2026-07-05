import type { Request, Response as ExpressResponse } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { setAuthCookie, clearAuthCookie, signAuthToken } from '../../auth/jwt.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

function sendValidationError(res: ExpressResponse, message: string) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
  });
}

function sendUnauthorized(res: ExpressResponse) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class AuthController {
  register = async (req: Request, res: ExpressResponse) => {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendValidationError(
        res,
        parsed.error.issues[0]?.message ?? 'Invalid registration input',
      );
    }

    const { email, password, name } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    setAuthCookie(res, signAuthToken(user.id));
    return res.status(201).json({ success: true, data: { user } });
  };

  login = async (req: Request, res: ExpressResponse) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendValidationError(res, parsed.error.issues[0]?.message ?? 'Invalid login input');
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      return sendUnauthorized(res);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return sendUnauthorized(res);
    }

    setAuthCookie(res, signAuthToken(user.id));
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });
  };

  logout = async (_req: Request, res: ExpressResponse) => {
    clearAuthCookie(res);
    return res.status(200).json({ success: true, data: { ok: true } });
  };

  me = async (req: Request, res: ExpressResponse) => {
    const user = (req as AuthenticatedRequest).user;
    return res.status(200).json({ success: true, data: { user } });
  };
}

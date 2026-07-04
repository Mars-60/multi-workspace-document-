import type { Request, Response as ExpressResponse } from 'express';

import { auth } from '../../auth/better-auth.js';

async function sendAuthResponse(result: globalThis.Response, res: ExpressResponse) {
  result.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === 'set-cookie') {
      res.append('Set-Cookie', value);
    } else {
      res.setHeader(key, value);
    }
  });

  res.status(result.status).json(await result.json());
}

export class AuthController {
  signUp = async (req: Request, res: ExpressResponse) => {
    const { email, password, name } = req.body ?? {};
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      asResponse: true,
    });

    await sendAuthResponse(result, res);
  };

  signIn = async (req: Request, res: ExpressResponse) => {
    const { email, password } = req.body ?? {};
    const result = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    await sendAuthResponse(result, res);
  };

  signOut = async (req: Request, res: ExpressResponse) => {
    const result = await auth.api.signOut({
      headers: new Headers(req.headers as Record<string, string>),
      asResponse: true,
    });
    await sendAuthResponse(result, res);
  };

  session = async (req: Request, res: ExpressResponse) => {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    res.status(session ? 200 : 401).json(
      session
        ? { success: true, data: { user: session.user, session: session.session } }
        : { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    );
  };
}

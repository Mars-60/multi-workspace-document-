import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
  next();
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (typeof req.body === 'object' && req.body) {
    const sanitized = JSON.parse(JSON.stringify(req.body));
    req.body = sanitized;
  }
  next();
}

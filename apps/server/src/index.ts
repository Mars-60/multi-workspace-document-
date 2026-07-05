import 'dotenv/config';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';

import env from './config/env.js';
import { requestIdMiddleware, sanitizeInput } from './middleware/security.middleware.js';
import { createLogger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { createAppRouter } from './routes/index.js';

type SerializedError =
  | {
      name: string;
      message: string;
      code?: string;
      detail?: string;
      cause?: unknown;
      errors?: SerializedError[];
      stack?: string;
    }
  | unknown;

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const withDetails = error as Error & {
      cause?: unknown;
      code?: string;
      detail?: string;
      errors?: unknown[];
    };

    return {
      name: error.name,
      message: error.message,
      code: withDetails.code,
      detail: withDetails.detail,
      cause: withDetails.cause,
      errors: withDetails.errors?.map(serializeError),
      stack: error.stack,
    };
  }

  return error;
}

const logger = createLogger('server');

process.on('unhandledRejection', (reason) => {
  logger.error({ error: serializeError(reason) }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error: serializeError(error) }, 'Uncaught exception');
  process.exit(1);
});

const app = express();
const port = env.PORT;
const corsOptions: CorsOptions = {
  origin: env.CLIENT_URL,
  credentials: true,
  optionsSuccessStatus: 204,
};

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(cookieParser());
app.use(limiter);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(sanitizeInput);
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'server' });
});

app.use('/api', createAppRouter());

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: serializeError(error) }, 'Request failed');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
});

async function verifyDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Postgres startup health check succeeded');
  } catch (error) {
    logger.fatal({ error: serializeError(error) }, 'Postgres startup health check failed');
    process.exit(1);
  }
}

await verifyDatabaseConnection();

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

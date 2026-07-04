import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';

import env from './config/env.js';
import { requestIdMiddleware, sanitizeInput } from './middleware/security.middleware.js';
import { createLogger } from './lib/logger.js';
import { createAppRouter } from './routes/index.js';

const logger = createLogger('server');

const app = express();
const port = env.PORT;

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
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

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

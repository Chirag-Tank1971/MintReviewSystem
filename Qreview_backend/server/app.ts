import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { getDatabaseStatus } from './db.js';
import { getConfig } from './config.js';
import { authenticateToken, requireRoles, getTokenSubject } from './auth.js';
import { authRouter } from './routes/authRoutes.js';
import { mastersRouter } from './routes/mastersRoutes.js';
import { kraRouter } from './routes/kraRoutes.js';
import { reviewRouter } from './routes/reviewRoutes.js';
import { appraisalRouter } from './routes/appraisalRoutes.js';
import { essRouter } from './routes/essRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { bulkRouter } from './routes/bulkRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { aiAndFeedbackRouter } from './routes/aiAndFeedbackRoutes.js';
import { emailRouter } from './routes/emailRoutes.js';
import { managementRouter } from './routes/managementRoutes.js';
import { pipRouter } from './routes/pipRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { salesChampsRouter } from './routes/salesChampsRoutes.js';

export interface CreateAppOptions {
  /** Request logger used for slow-request lines (kept on in production). */
  log?: (msg: string) => void;
  /** Serve the compiled frontend if a dist folder is found. Disabled in tests. */
  serveFrontend?: boolean;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Builds the Express application without touching the database connection, background jobs
 * or the network port, so it can be exercised directly in tests.
 */
export function createApp(options: CreateAppOptions = {}): express.Express {
  const cfg = getConfig();
  const log = options.log ?? console.log;
  const app = express();

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------
  const configuredOrigins = cfg.ALLOWED_ORIGINS
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const isOriginAllowed = (origin: string): boolean => {
    // Requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return true;
    const cleanOrigin = origin.replace(/\/$/, '');
    if (!cfg.isProduction) return true;
    if (configuredOrigins.includes('*')) return true;
    if (configuredOrigins.includes(cleanOrigin)) return true;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) return true;

    // Wildcard subdomain patterns in ALLOWED_ORIGINS (e.g. *.vercel.app)
    for (const rawPattern of configuredOrigins) {
      const pattern = rawPattern.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (pattern.startsWith('*.')) {
        const rootDomain = pattern.slice(2);
        try {
          const originHost = new URL(cleanOrigin).hostname;
          if (originHost === rootDomain || originHost.endsWith('.' + rootDomain)) return true;
        } catch {
          // ignore malformed URL
        }
      }
    }

    // Vercel preview and production deployments for this application
    return /^https:\/\/(mint-review-system.*|.*chirag-tank1971s-projects)\.vercel\.app$/i.test(cleanOrigin);
  };

  const corsMiddleware = cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin || '')),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 204,
  });

  app.use(corsMiddleware);
  app.options('*', corsMiddleware);

  // gzip responses over 1 KB
  app.use(compression({ threshold: 1024 }));

  // Always-on slow-request log, so slow endpoints show up in the host's logs
  const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS) || 800;
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (ms >= SLOW_REQUEST_MS) {
        log(`[SLOW] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms`);
      }
    });
    next();
  });

  // Essential HTTP security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Trust the first reverse proxy hop (Render, Cloudflare, Nginx) for req.ip
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Structured HTTP logger (development, or when ENABLE_PROD_LOGS=true)
  if ((!cfg.isProduction && cfg.NODE_ENV !== 'test') || process.env.ENABLE_PROD_LOGS === 'true') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const status = res.statusCode;
        const msg = `[HTTP] ${req.method} ${req.originalUrl} ${status} - ${Date.now() - start}ms`;
        if (status >= 500) console.error(msg);
        else if (status >= 400) console.warn(msg);
        else console.log(msg);
      });
      next();
    });
  }

  // Malformed JSON payloads → 400 instead of a generic 500
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON payload provided.' });
    }
    next(err);
  });

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------
  // Login: max 10 failed attempts per IP per 15 minutes
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: FIFTEEN_MINUTES,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      message: { error: 'Too many login attempts from this IP. Please wait 15 minutes and try again.' },
    })
  );

  // General API: authenticated traffic is limited per user (so an office sharing one public IP
  // doesn't share one budget); anonymous traffic is limited per IP.
  const bearer = (req: express.Request) => req.headers['authorization']?.split(' ')[1];
  app.use(
    '/api',
    rateLimit({
      windowMs: FIFTEEN_MINUTES,
      limit: (req) => (getTokenSubject(bearer(req)) ? cfg.RATE_LIMIT_AUTH_MAX : cfg.RATE_LIMIT_ANON_MAX),
      keyGenerator: (req) => {
        const userId = getTokenSubject(bearer(req));
        return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip || 'unknown')}`;
      },
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please slow down and try again shortly.' },
    })
  );

  // ---------------------------------------------------------------------------
  // System endpoints
  // ---------------------------------------------------------------------------
  // Public liveness probe: deliberately minimal
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Database diagnostics: Super Admin only
  app.get('/api/system/db-status', authenticateToken, requireRoles('SUPER_ADMIN'), async (_req, res) => {
    try {
      res.json(await getDatabaseStatus());
    } catch {
      res.status(500).json({ error: 'Failed to retrieve database status' });
    }
  });

  // ---------------------------------------------------------------------------
  // API routes
  // ---------------------------------------------------------------------------
  app.use('/api/auth', authRouter);
  app.use('/api', mastersRouter);
  app.use('/api', kraRouter);
  app.use('/api', reviewRouter);
  app.use('/api', appraisalRouter);
  app.use('/api', essRouter);
  app.use('/api', reportRouter);
  app.use('/api/bulk', bulkRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api', aiAndFeedbackRouter);
  app.use('/api/emails', emailRouter);
  app.use('/api', pipRouter);
  app.use('/api', managementRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', salesChampsRouter);

  // Standard JSON 404 for unmatched /api routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Serve compiled frontend assets if available
  if (options.serveFrontend !== false) {
    const possibleDistPaths = [
      path.resolve(process.cwd(), '../Qreview_frontend/dist'),
      path.resolve(process.cwd(), '../frontend/dist'),
      path.resolve(process.cwd(), 'dist/public'),
      path.resolve(process.cwd(), 'dist'),
    ];
    const frontendDist = possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));
    if (frontendDist) {
      app.use(express.static(frontendDist));
      app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
    }
  }

  // Global error handler: JSON, never an HTML stack trace
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled Server Error]', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

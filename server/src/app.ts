import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import type { AppContext } from './context.js';
import { errorHandler, HttpError } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { checkRouter } from './routes/check.js';
import { demoRouter } from './routes/demo.js';
import { newsRouter } from './routes/news.js';

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', /^\d+$/.test(ctx.config.trustProxy) ? Number(ctx.config.trustProxy) : ctx.config.trustProxy === 'true' ? true : ctx.config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '256kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true, version: ctx.version }));
  api.get('/meta', (_req, res) => {
    const llm = ctx.settings.llmConfig();
    const aiReady = ctx.settings.aiReady();
    res.json({
      version: ctx.version,
      ai: { ready: aiReady, provider: aiReady ? llm.provider : 'none', model: aiReady ? llm.model : null, vision: aiReady && llm.vision },
      limits: { maxImages: ctx.config.maxImages, maxImageMB: Math.round(ctx.config.maxImageBytes / 1024 / 1024), maxTextChars: ctx.config.maxTextChars, checksPerHour: ctx.settings.limits.checksPerHour },
      news: { aiExplain: aiReady && ctx.settings.news.aiExplain },
      stats: ctx.stats.snapshot(),
    });
  });
  api.use(checkRouter(ctx));
  api.use(demoRouter(ctx));
  api.use(newsRouter(ctx));
  api.use(adminRouter(ctx));
  api.use((_req, _res, next) => next(new HttpError(404, 'Unbekannter API-Endpunkt.')));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', api);

  // Frontend (built by Vite). Hashed assets are cached forever, index.html never.
  const indexHtml = path.join(ctx.config.webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(ctx.config.webDist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'public, max-age=3600');
        },
      }),
    );
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('ScamCheck API läuft. Das Frontend wurde nicht gebaut – starte im Entwicklungsmodus mit `npm run dev` oder baue es mit `npm run build`.');
    });
  }

  app.use(errorHandler);
  return app;
}

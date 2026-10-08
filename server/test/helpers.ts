import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import type { AppContext } from '../src/context.js';
import { AdminAuth } from '../src/middleware/auth.js';
import { RateLimiter } from '../src/middleware/rateLimit.js';
import { NewsAggregator } from '../src/news/aggregator.js';
import { SettingsStore } from '../src/store/settings.js';
import { StatsStore } from '../src/store/stats.js';

export const ADMIN_PASSWORD = 'test-admin-pw';

export function makeTestApp(opts: { env?: NodeJS.ProcessEnv; checksPerHour?: number; fetchImpl?: typeof fetch } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scamcheck-test-'));
  const settings = new SettingsStore(dataDir, 'test-secret', opts.env ?? {});
  if (opts.checksPerHour) settings.update({ limits: { checksPerHour: opts.checksPerHour } });
  const news = new NewsAggregator(dataDir, () => settings.feeds(), () => 30, opts.fetchImpl);
  const ctx: AppContext = {
    config: { ...config, dataDir },
    settings,
    stats: new StatsStore(dataDir),
    news,
    auth: new AdminAuth(dataDir, ADMIN_PASSWORD, settings.secretBox.signingKey),
    limiters: {
      check: new RateLimiter(3600_000, () => settings.limits.checksPerHour),
      explain: new RateLimiter(3600_000, () => settings.limits.explainPerHour),
      login: new RateLimiter(15 * 60_000, () => 10),
    },
    version: 'test',
  };
  return { app: createApp(ctx), ctx, dataDir };
}

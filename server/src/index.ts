import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { config, SERVER_ROOT } from './config.js';
import type { AppContext } from './context.js';
import { AdminAuth } from './middleware/auth.js';
import { RateLimiter } from './middleware/rateLimit.js';
import { NewsAggregator } from './news/aggregator.js';
import { SettingsStore } from './store/settings.js';
import { StatsStore } from './store/stats.js';

const version = (JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8')) as { version: string }).version;

fs.mkdirSync(config.dataDir, { recursive: true });
const settings = new SettingsStore(config.dataDir, config.settingsSecret);
const stats = new StatsStore(config.dataDir);
const auth = new AdminAuth(config.dataDir, config.adminPassword, settings.secretBox.signingKey);
const news = new NewsAggregator(
  config.dataDir,
  () => settings.feeds(),
  () => settings.news.refreshMinutes,
);

const ctx: AppContext = {
  config,
  settings,
  stats,
  news,
  auth,
  limiters: {
    check: new RateLimiter(3600_000, () => settings.limits.checksPerHour),
    explain: new RateLimiter(3600_000, () => settings.limits.explainPerHour),
    login: new RateLimiter(15 * 60_000, () => 10),
  },
  version,
};

const app = createApp(ctx);
const server = app.listen(config.port, config.host, () => {
  const llm = settings.llmConfig();
  console.log(`\n  🛡️  ScamCheck v${version} läuft auf http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`  KI-Analyse: ${settings.aiReady() ? `${llm.provider} / ${llm.model}` : 'nicht konfiguriert (nur Mustererkennung)'}`);
  console.log(`  Daten: ${config.dataDir}`);
  const generated = auth.revealGenerated();
  if (generated) {
    console.log(`\n  Admin-Passwort wurde erzeugt: ${generated}`);
    console.log(`  (gespeichert in ${path.join(config.dataDir, 'admin-password.txt')} – oder per ADMIN_PASSWORD festlegen)\n`);
  } else if (!config.adminPassword) {
    console.log(`  Admin-Passwort: siehe ${path.join(config.dataDir, 'admin-password.txt')}`);
  }
});

if (!config.newsDisabled) news.start();

const shutdown = (signal: string) => {
  console.log(`[server] ${signal} empfangen – fahre herunter …`);
  news.stop();
  stats.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

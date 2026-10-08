import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** server/ – works for both src/ (tsx) and dist/ (compiled). */
export const SERVER_ROOT = path.resolve(here, '..');

const env = process.env;
const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(env.PORT, 8080),
  host: env.HOST ?? '0.0.0.0',
  dataDir: path.resolve(env.DATA_DIR ?? path.join(SERVER_ROOT, '..', 'data')),
  webDist: path.resolve(env.WEB_DIST ?? path.join(SERVER_ROOT, '..', 'web', 'dist')),
  promptsDir: path.resolve(env.PROMPTS_DIR ?? path.join(SERVER_ROOT, 'prompts')),
  /** Express "trust proxy" – set when running behind nginx/Traefik/Caddy so rate limits see the real client IP. */
  trustProxy: env.TRUST_PROXY ?? 'loopback',
  adminPassword: env.ADMIN_PASSWORD ?? '',
  settingsSecret: env.SETTINGS_SECRET ?? '',
  maxImages: int(env.MAX_IMAGES, 3),
  maxImageBytes: int(env.MAX_IMAGE_MB, 6) * 1024 * 1024,
  maxTextChars: int(env.MAX_TEXT_CHARS, 12000),
  newsDisabled: env.NEWS_DISABLED === '1' || env.NODE_ENV === 'test',
  isProduction: env.NODE_ENV === 'production',
};

export type AppConfig = typeof config;

import type { AppConfig } from './config.js';
import type { AdminAuth } from './middleware/auth.js';
import type { RateLimiter } from './middleware/rateLimit.js';
import type { NewsAggregator } from './news/aggregator.js';
import type { SettingsStore } from './store/settings.js';
import type { StatsStore } from './store/stats.js';

export interface AppContext {
  config: AppConfig;
  settings: SettingsStore;
  stats: StatsStore;
  news: NewsAggregator;
  auth: AdminAuth;
  limiters: {
    check: RateLimiter;
    explain: RateLimiter;
    login: RateLimiter;
  };
  version: string;
}

import fs from 'node:fs';
import path from 'node:path';
import type { ScamCategory, Verdict } from '../types.js';
import { writeFileAtomic } from './crypto.js';

interface StatsData {
  since: string;
  totalChecks: number;
  aiChecks: number;
  byVerdict: Partial<Record<Verdict, number>>;
  byCategory: Partial<Record<ScamCategory, number>>;
}

/**
 * Anonymous counters only – submitted content is never stored on the server.
 */
export class StatsStore {
  private data: StatsData;
  private readonly file: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'stats.json');
    this.data = { since: new Date().toISOString(), totalChecks: 0, aiChecks: 0, byVerdict: {}, byCategory: {} };
    try {
      if (fs.existsSync(this.file)) this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch {
      /* start fresh */
    }
  }

  record(verdict: Verdict, category: ScamCategory, ai: boolean) {
    this.data.totalChecks++;
    if (ai) this.data.aiChecks++;
    this.data.byVerdict[verdict] = (this.data.byVerdict[verdict] ?? 0) + 1;
    if (category !== 'none') this.data.byCategory[category] = (this.data.byCategory[category] ?? 0) + 1;
    this.scheduleSave();
  }

  snapshot() {
    const v = this.data.byVerdict;
    return {
      since: this.data.since,
      totalChecks: this.data.totalChecks,
      aiChecks: this.data.aiChecks,
      warned: (v.suspicious ?? 0) + (v.likely_scam ?? 0) + (v.scam ?? 0),
      byVerdict: this.data.byVerdict,
      topCategories: Object.entries(this.data.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([category, count]) => ({ category, count })),
    };
  }

  private scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        writeFileAtomic(this.file, JSON.stringify(this.data, null, 2), 0o644);
      } catch (err) {
        console.warn('[stats] Speichern fehlgeschlagen:', (err as Error).message);
      }
    }, 2000);
    this.timer.unref();
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      writeFileAtomic(this.file, JSON.stringify(this.data, null, 2), 0o644);
    }
  }
}

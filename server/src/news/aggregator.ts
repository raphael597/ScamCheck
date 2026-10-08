import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Parser from 'rss-parser';
import { writeFileAtomic } from '../store/crypto.js';
import { classify, isWarning, type Topic } from './classify.js';
import { sampleNews } from './fallback.js';
import type { FeedConfig } from './sources.js';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  source: { id: string; name: string; lang: 'de' | 'en'; kind: FeedConfig['kind'] };
  /** Remote image URL – never sent to browsers; images are served through /api/news/image/:id. */
  image: string | null;
  topics: Topic[];
  isWarning: boolean;
  isSample?: boolean;
}

export interface SourceStatus {
  id: string;
  name: string;
  lang: 'de' | 'en';
  kind: FeedConfig['kind'];
  enabled: boolean;
  ok: boolean | null;
  count: number;
  lastFetched: string | null;
  lastError: string | null;
}

export interface NewsQuery {
  topic?: string;
  lang?: string;
  kind?: string;
  q?: string;
  warnings?: boolean;
  limit?: number;
  offset?: number;
}

type FeedItem = Parser.Item & {
  mediaContent?: { $?: { url?: string; medium?: string; type?: string } }[];
  mediaThumbnail?: { $?: { url?: string } };
  contentEncoded?: string;
  summary?: string;
  id?: string;
};

const USER_AGENT = 'Mozilla/5.0 (compatible; ScamCheckNews/1.0; +https://github.com/raphael597/scamcheck)';
const MAX_FEED_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 400;
const MAX_AGE_DAYS = 45;

const parser: Parser<object, FeedItem> = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
      ['summary', 'summary'],
    ],
  },
});

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”' };

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

function pickImage(item: FeedItem): string | null {
  const candidates: (string | undefined)[] = [];
  if (item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith('image/'))) candidates.push(item.enclosure.url);
  for (const m of item.mediaContent ?? []) {
    if (m.$?.url && (m.$.medium === 'image' || m.$.type?.startsWith('image/') || /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(m.$.url))) candidates.push(m.$.url);
  }
  candidates.push(item.mediaThumbnail?.$?.url);
  for (const html of [item.contentEncoded, item.content, item.summary]) {
    const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) candidates.push(m[1]);
  }
  const url = candidates.find((c) => c && /^https?:\/\//i.test(c) && !/feedburner|pixel|tracking|1x1|gravatar/i.test(c));
  return url ? url.replace(/&amp;/g, '&') : null;
}

export function normalizeItems(feed: FeedConfig, items: FeedItem[]): NewsItem[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400_000;
  const out: NewsItem[] = [];
  for (const item of items) {
    const title = stripHtml(item.title ?? '');
    const link = (item.link ?? '').trim();
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const date = new Date(item.isoDate ?? item.pubDate ?? Date.now());
    const publishedAt = Number.isNaN(date.getTime()) ? new Date() : date;
    if (publishedAt.getTime() < cutoff) continue;
    const summary = truncate(stripHtml(item.contentSnippet || item.summary || item.contentEncoded || item.content || ''), 320);
    const topics = classify(`${title} ${summary}`);
    out.push({
      id: createHash('sha1').update(link).digest('hex').slice(0, 16),
      title: truncate(title, 200),
      link,
      summary,
      publishedAt: (publishedAt.getTime() > Date.now() ? new Date() : publishedAt).toISOString(),
      source: { id: feed.id, name: feed.name, lang: feed.lang, kind: feed.kind },
      image: pickImage(item),
      topics,
      isWarning: isWarning(topics, feed.kind),
    });
  }
  return out;
}

/** Feed-supplied image URLs must not point the server at local or private addresses. */
export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(?:127|10|0)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.|^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return false;
  if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host === '::')) return false;
  return true;
}

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Antwort zu groß');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export class NewsAggregator {
  private items: NewsItem[] = [];
  private status = new Map<string, SourceStatus>();
  private updatedAt: string | null = null;
  private refreshing: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly cacheFile: string;
  private imageCache = new Map<string, { type: string; data: Buffer }>();

  constructor(
    dataDir: string,
    private readonly getFeeds: () => FeedConfig[],
    private readonly getRefreshMinutes: () => number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.cacheFile = path.join(dataDir, 'news-cache.json');
  }

  start() {
    this.loadCache();
    void this.refresh();
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Re-arms the refresh timer (call after settings change). */
  schedule() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.refresh(), this.getRefreshMinutes() * 60_000);
    this.timer.unref();
  }

  private loadCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) return;
      const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')) as { items: NewsItem[]; updatedAt: string };
      this.items = data.items ?? [];
      this.updatedAt = data.updatedAt ?? null;
    } catch {
      /* ignore broken cache */
    }
  }

  private saveCache() {
    try {
      writeFileAtomic(this.cacheFile, JSON.stringify({ updatedAt: this.updatedAt, items: this.items }), 0o644);
    } catch (err) {
      console.warn('[news] Cache konnte nicht gespeichert werden:', (err as Error).message);
    }
  }

  async fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
    const res = await this.fetchImpl(feed.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = (await readLimited(res, MAX_FEED_BYTES)).toString('utf8');
    const parsed = await parser.parseString(xml);
    return normalizeItems(feed, parsed.items ?? []);
  }

  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const feeds = this.getFeeds();
      const enabled = feeds.filter((f) => f.enabled);
      const fresh: NewsItem[] = [];
      const queue = [...enabled];
      const worker = async () => {
        for (let feed = queue.shift(); feed; feed = queue.shift()) {
          const now = new Date().toISOString();
          try {
            const items = await this.fetchFeed(feed);
            fresh.push(...items);
            this.status.set(feed.id, { ...this.baseStatus(feed), ok: true, count: items.length, lastFetched: now, lastError: null });
          } catch (err) {
            const message = (err as Error).name === 'TimeoutError' ? 'Zeitüberschreitung' : (err as Error).message;
            this.status.set(feed.id, { ...this.baseStatus(feed), ok: false, count: 0, lastFetched: now, lastError: message.slice(0, 200) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, enabled.length) }, worker));

      for (const feed of feeds.filter((f) => !f.enabled)) this.status.set(feed.id, { ...this.baseStatus(feed), ok: null });
      for (const id of [...this.status.keys()]) if (!feeds.some((f) => f.id === id)) this.status.delete(id);

      if (fresh.length) {
        const okSources = new Set([...this.status.values()].filter((s) => s.ok).map((s) => s.id));
        const enabledIds = new Set(enabled.map((f) => f.id));
        // Keep cached items of sources that failed this round so a flaky feed doesn't empty the list.
        const kept = this.items.filter((i) => !i.isSample && !okSources.has(i.source.id) && enabledIds.has(i.source.id));
        const seen = new Set<string>();
        this.items = [...fresh, ...kept]
          .filter((i) => {
            const title = i.title.toLowerCase();
            if (seen.has(i.id) || seen.has(title)) return false;
            seen.add(i.id).add(title);
            return true;
          })
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
          .slice(0, MAX_ITEMS);
        this.updatedAt = new Date().toISOString();
        this.saveCache();
      }
      const failed = [...this.status.values()].filter((s) => s.ok === false).length;
      console.log(`[news] ${fresh.length} Meldungen aus ${enabled.length - failed}/${enabled.length} Quellen geladen`);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private baseStatus(feed: FeedConfig): SourceStatus {
    const prev = this.status.get(feed.id);
    return {
      id: feed.id,
      name: feed.name,
      lang: feed.lang,
      kind: feed.kind,
      enabled: feed.enabled,
      ok: prev?.ok ?? null,
      count: prev?.count ?? 0,
      lastFetched: prev?.lastFetched ?? null,
      lastError: prev?.lastError ?? null,
    };
  }

  private allItems(): { items: NewsItem[]; isSample: boolean } {
    return this.items.length ? { items: this.items, isSample: false } : { items: sampleNews(), isSample: true };
  }

  list(query: NewsQuery) {
    const { items, isSample } = this.allItems();
    const q = query.q?.trim().toLowerCase();
    const filtered = items.filter(
      (i) =>
        (!query.topic || i.topics.includes(query.topic as Topic)) &&
        (!query.lang || i.source.lang === query.lang) &&
        (!query.kind || i.source.kind === query.kind) &&
        (!query.warnings || i.isWarning) &&
        (!q || i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || i.source.name.toLowerCase().includes(q)),
    );
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    return {
      items: filtered.slice(offset, offset + limit).map(({ image, ...rest }) => ({ ...rest, hasImage: Boolean(image) })),
      total: filtered.length,
      isSample,
      updatedAt: this.updatedAt,
      sources: this.sources(),
    };
  }

  sources(): SourceStatus[] {
    return this.getFeeds().map((f) => this.status.get(f.id) ?? this.baseStatus(f));
  }

  get(id: string): NewsItem | undefined {
    return this.allItems().items.find((i) => i.id === id);
  }

  /** Proxies feed images so visitors' browsers never contact third-party servers. */
  async image(id: string): Promise<{ type: string; data: Buffer } | null> {
    const cached = this.imageCache.get(id);
    if (cached) return cached;
    const item = this.items.find((i) => i.id === id);
    if (!item?.image || !isPublicHttpUrl(item.image)) return null;
    const res = await this.fetchImpl(item.image,{ headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10000), redirect: 'follow' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(?:jpeg|png|webp|gif|avif)/i.test(type)) return null;
    const data = await readLimited(res, 3 * 1024 * 1024);
    const entry = { type, data };
    this.imageCache.set(id, entry);
    if (this.imageCache.size > 150) this.imageCache.delete(this.imageCache.keys().next().value!);
    return entry;
  }
}

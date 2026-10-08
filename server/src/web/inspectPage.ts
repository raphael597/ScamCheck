import { parse } from 'tldts';
import { analyzeUrl, officialBrandFor } from '../analysis/urls.js';
import { stripHtml } from '../lib/html.js';
import type { HeuristicSignal, PageFinding, UrlFinding } from '../types.js';
import { FetchBlockedError, safeFetch } from './safeFetch.js';

export interface PageInspection extends PageFinding {
  /** Visible text excerpt – only passed to the AI, never sent to the browser. */
  text: string;
}

export interface InspectOptions {
  timeoutMs?: number;
  domainAge?: boolean;
  allowPrivate?: boolean;
}

const TEXT_LIMIT = 5000;
const DAY = 86_400_000;

const PAYMENT_PATTERNS: [string, RegExp][] = [
  ['Vorkasse/Überweisung', /vorkasse|vorauskasse|banküberweisung|überweisung|bank ?transfer|wire transfer/i],
  ['PayPal', /paypal/i],
  ['Kreditkarte', /kreditkarte|visa|mastercard|american express|credit card/i],
  ['Kauf auf Rechnung', /klarna|kauf auf rechnung|rechnungskauf|auf rechnung|pay later/i],
  ['Apple/Google Pay', /apple ?pay|google ?pay/i],
  ['Sofort/Giropay', /sofortüberweisung|sofort\.com|giropay|\beps\b/i],
  ['Krypto', /bitcoin|krypto|crypto|usdt|ethereum|wallet-?adresse/i],
  ['Gutscheinkarten', /paysafecard|gift ?cards?|gutscheinkarte/i],
];
const BUYER_PROTECTION = new Set(['PayPal', 'Kreditkarte', 'Kauf auf Rechnung', 'Apple/Google Pay']);

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function decodeBody(body: Buffer, contentType: string): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = body.subarray(0, 4096).toString('latin1');
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  for (const label of [fromHeader, fromMeta, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      /* unknown label – try next */
    }
  }
  return body.toString('utf8');
}

export function parseRdapCreated(data: unknown): string | null {
  const events = (data as { events?: { eventAction?: string; eventDate?: string }[] })?.events;
  const reg = events?.find((e) => e.eventAction === 'registration')?.eventDate;
  return reg && !Number.isNaN(Date.parse(reg)) ? new Date(reg).toISOString() : null;
}

// ── Domain age via RDAP (official IANA bootstrap) ─────────────────────
let bootstrap: { map: Map<string, string>; at: number } | null = null;
const ageCache = new Map<string, { created: string | null; at: number }>();

async function rdapBase(tld: string, allowPrivate: boolean): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > DAY) {
    const res = await safeFetch('https://data.iana.org/rdap/dns.json', { accept: 'application/json', allowedTypes: /json|text\/plain|octet-stream/i, timeoutMs: 5000, allowPrivate });
    const json = JSON.parse(res.body.toString('utf8')) as { services: [string[], string[]][] };
    const map = new Map<string, string>();
    for (const [tlds, urls] of json.services) {
      const url = urls.find((u) => u.startsWith('https://')) ?? urls[0];
      if (url) for (const t of tlds) map.set(t.toLowerCase(), url.endsWith('/') ? url : `${url}/`);
    }
    bootstrap = { map, at: Date.now() };
  }
  return bootstrap.map.get(tld) ?? null;
}

export async function domainCreated(domain: string, allowPrivate = false): Promise<string | null> {
  const cached = ageCache.get(domain);
  if (cached && Date.now() - cached.at < DAY) return cached.created;
  const tld = domain.split('.').pop()!.toLowerCase();
  let created: string | null = null;
  try {
    const base = await rdapBase(tld, allowPrivate);
    if (base) {
      const res = await safeFetch(`${base}domain/${encodeURIComponent(domain)}`, {
        accept: 'application/rdap+json, application/json',
        allowedTypes: /json/i,
        timeoutMs: 5000,
        allowPrivate,
      });
      if (res.status === 200) created = parseRdapCreated(JSON.parse(res.body.toString('utf8')));
    }
  } catch {
    /* RDAP is best effort – many ccTLDs (e.g. .de) publish no dates */
  }
  ageCache.set(domain, { created, at: Date.now() });
  if (ageCache.size > 2000) ageCache.delete(ageCache.keys().next().value!);
  return created;
}

// ── HTML inspection ───────────────────────────────────────────────────
export function extractPageFacts(html: string, pageUrl: string) {
  const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 200);
  let description = '';
  let refresh: string | null = null;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase();
    const httpEquiv = (attr(tag, 'http-equiv') ?? '').toLowerCase();
    const content = attr(tag, 'content') ?? '';
    if (!description && (key === 'description' || key === 'og:description')) description = stripHtml(content).slice(0, 300);
    if (httpEquiv === 'refresh') refresh = content.match(/url\s*=\s*['"]?([^'";]+)/i)?.[1]?.trim() ?? null;
  }

  const pageDomain = parse(new URL(pageUrl).hostname).domain;
  const links: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (links.length > 3000) break;
    links.push({ href: attr(` ${m[1]}`, 'href') ?? '', text: stripHtml(m[2] ?? '').slice(0, 80) });
  }
  const linkMatches = (re: RegExp) => links.some((l) => re.test(l.href) || re.test(l.text));

  const body = html
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ');
  const text = stripHtml(body);
  const alts = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => attr(m[0], 'alt') ?? '').join(' ');
  const paymentText = `${text} ${alts} ${links.map((l) => `${l.href} ${l.text}`).join(' ')}`;

  const hasImprint = linkMatches(/impressum|imprint|legal[-_ ]?notice|anbieterkennzeichnung|mentions[-_ ]l[ée]gales/i) || /\bimpressum\b/i.test(text);
  const hasPrivacy = linkMatches(/datenschutz|privacy/i);
  const hasTerms = linkMatches(/\bagb\b|terms|conditions|nutzungsbedingungen|geschäftsbedingungen/i);
  const looksLikeShop = /warenkorb|in den warenkorb|add to cart|zur kasse|checkout|jetzt kaufen|buy now|versandkosten|lieferzeit|inkl\.?\s*mwst/i.test(text);

  let asksPassword = false;
  let asksPayment = false;
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const type = (attr(tag, 'type') ?? 'text').toLowerCase();
    const hint = `${attr(tag, 'name') ?? ''} ${attr(tag, 'id') ?? ''} ${attr(tag, 'autocomplete') ?? ''} ${attr(tag, 'placeholder') ?? ''}`.toLowerCase();
    if (type === 'password') asksPassword = true;
    if (/cc-?(number|csc|exp)|card-?number|cardnumber|kartennummer|\bcvc\b|\bcvv\b|security-?code|prüfziffer|\biban\b|\btan\b|pushtan|online-?banking|\bpin\b/.test(hint)) asksPayment = true;
  }

  const formTargets = new Set<string>();
  for (const m of html.matchAll(/<form\b([^>]*)>/gi)) {
    const action = attr(` ${m[1]}`, 'action');
    if (!action) continue;
    try {
      const target = new URL(action, pageUrl);
      const d = parse(target.hostname).domain;
      if (/^https?:$/.test(target.protocol) && d && d !== pageDomain) formTargets.add(d);
    } catch {
      /* ignore broken action */
    }
  }

  const paymentMethods = PAYMENT_PATTERNS.filter(([, re]) => re.test(paymentText)).map(([label]) => label);
  const discounts = [...text.matchAll(/-\s?(\d{2})\s?%|(\d{2})\s?%\s*(?:rabatt|off|reduziert|sale|günstiger)/gi)].map((m) => Number(m[1] ?? m[2]));
  const maxDiscount = discounts.length ? Math.max(...discounts) : 0;

  return {
    title,
    description,
    refresh,
    text: text.slice(0, TEXT_LIMIT),
    textLength: text.length,
    hasImprint,
    hasPrivacy,
    hasTerms,
    looksLikeShop,
    asksPassword,
    asksPayment,
    formTargets: [...formTargets].slice(0, 3),
    paymentMethods,
    maxDiscount,
  };
}

function describeIssues(p: Omit<PageInspection, 'issues'>, requestedDomain: string | null, maxDiscount: number, textLength: number): string[] {
  const issues: string[] = [];
  if (p.domain && requestedDomain && p.domain !== requestedDomain) issues.push(`Leitet weiter auf eine andere Domain: ${p.domain}`);
  if (p.status && p.status >= 400) issues.push(`Seite antwortet mit Fehler ${p.status}`);
  if (p.domainAgeDays != null && p.domainAgeDays < 30) issues.push(`Domain wurde erst vor ${p.domainAgeDays} Tagen registriert`);
  else if (p.domainAgeDays != null && p.domainAgeDays < 180) issues.push(`Domain ist noch recht neu (registriert vor ${p.domainAgeDays} Tagen)`);
  if (p.asksPassword) issues.push('Seite fragt ein Passwort ab');
  if (p.asksPayment) issues.push('Seite fragt Karten-, Bank- oder TAN-Daten ab');
  for (const t of p.formTargets) issues.push(`Formular schickt Eingaben an eine fremde Domain: ${t}`);
  if (p.looksLikeShop && p.hasImprint === false) issues.push('Kein Impressum gefunden – für Shops in DE/AT/CH Pflicht');
  const protectedPay = p.paymentMethods.some((m) => BUYER_PROTECTION.has(m));
  if (p.paymentMethods.includes('Vorkasse/Überweisung') && !protectedPay && p.looksLikeShop) issues.push('Als Zahlungsart ist nur Vorkasse/Überweisung erkennbar');
  if (p.paymentMethods.includes('Krypto') || p.paymentMethods.includes('Gutscheinkarten')) issues.push('Zahlung per Krypto oder Gutscheinkarte wird erwähnt');
  if (maxDiscount >= 60) issues.push(`Extreme Rabatte auf der Seite (bis zu ${maxDiscount} %)`);
  if (p.ok && textLength < 200) issues.push('Seite zeigt ohne JavaScript kaum Inhalt');
  return issues;
}

/** Opens a link in a locked-down way and summarises what a visitor would see. */
export async function inspectPage(rawUrl: string, opts: InspectOptions = {}): Promise<PageInspection> {
  const started = Date.now();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let requestedDomain: string | null = null;
  try {
    requestedDomain = parse(new URL(url).hostname).domain;
  } catch {
    /* handled by fetch */
  }
  const agePromise = opts.domainAge && requestedDomain ? domainCreated(requestedDomain, opts.allowPrivate) : Promise.resolve(null);

  const base: PageInspection = {
    url: rawUrl,
    finalUrl: null,
    redirects: [],
    status: null,
    ok: false,
    title: '',
    description: '',
    domain: requestedDomain,
    hasImprint: null,
    hasPrivacy: null,
    hasTerms: null,
    looksLikeShop: false,
    paymentMethods: [],
    asksPassword: false,
    asksPayment: false,
    formTargets: [],
    domainCreated: null,
    domainAgeDays: null,
    issues: [],
    durationMs: 0,
    text: '',
  };

  try {
    let res;
    try {
      res = await safeFetch(url, { timeoutMs: opts.timeoutMs, allowPrivate: opts.allowPrivate });
    } catch (err) {
      // Links without scheme ("shop.example/abc") are tried with https first, then plain http.
      if (url === rawUrl || err instanceof FetchBlockedError) throw err;
      res = await safeFetch(`http://${rawUrl}`, { timeoutMs: opts.timeoutMs, allowPrivate: opts.allowPrivate });
    }
    let html = decodeBody(res.body, res.contentType);
    let facts = extractPageFacts(html, res.url);
    const redirects = [...res.redirects];
    // Follow one meta-refresh redirect, a common trick of phishing pages.
    if (facts.refresh) {
      try {
        const next = new URL(facts.refresh, res.url).toString();
        const followed = await safeFetch(next, { timeoutMs: opts.timeoutMs, allowPrivate: opts.allowPrivate });
        redirects.push(res.url, ...followed.redirects);
        res = followed;
        html = decodeBody(res.body, res.contentType);
        facts = extractPageFacts(html, res.url);
      } catch {
        /* keep the first page */
      }
    }
    const finalDomain = parse(new URL(res.url).hostname).domain;
    const created = finalDomain && finalDomain !== requestedDomain && opts.domainAge ? await domainCreated(finalDomain, opts.allowPrivate) : await agePromise;
    const page: PageInspection = {
      ...base,
      finalUrl: res.url,
      redirects,
      status: res.status,
      ok: res.status < 400,
      title: facts.title,
      description: facts.description,
      domain: finalDomain,
      hasImprint: facts.hasImprint,
      hasPrivacy: facts.hasPrivacy,
      hasTerms: facts.hasTerms,
      looksLikeShop: facts.looksLikeShop,
      paymentMethods: facts.paymentMethods,
      asksPassword: facts.asksPassword,
      asksPayment: facts.asksPayment,
      formTargets: facts.formTargets,
      domainCreated: created,
      domainAgeDays: created ? Math.floor((Date.now() - Date.parse(created)) / DAY) : null,
      text: res.contentType.includes('text/plain') ? stripHtml(html).slice(0, TEXT_LIMIT) : facts.text,
    };
    page.issues = describeIssues(page, requestedDomain, facts.maxDiscount, facts.textLength);
    page.durationMs = Date.now() - started;
    return page;
  } catch (err) {
    const created = await agePromise.catch(() => null);
    const page: PageInspection = {
      ...base,
      error: (err as Error).message.slice(0, 160),
      domainCreated: created,
      domainAgeDays: created ? Math.floor((Date.now() - Date.parse(created)) / DAY) : null,
    };
    page.issues = describeIssues(page, requestedDomain, 0, 1000);
    page.durationMs = Date.now() - started;
    return page;
  }
}

/** Opens up to `max` links, riskiest first, one per registrable domain. */
export async function inspectLinks(urls: UrlFinding[], max: number, opts: InspectOptions): Promise<PageInspection[]> {
  const seen = new Set<string>();
  const picked = [...urls]
    .sort((a, b) => b.risk - a.risk)
    .filter((u) => {
      const key = u.registrableDomain ?? u.host;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
  return Promise.all(picked.map((u) => inspectPage(u.url, opts)));
}

/** Turns page findings into pattern-engine signals and extra links (redirect targets). */
export function pageEvidence(pages: PageInspection[]): { signals: HeuristicSignal[]; urls: UrlFinding[] } {
  const signals: HeuristicSignal[] = [];
  const urls: UrlFinding[] = [];
  const add = (s: Omit<HeuristicSignal, 'matches'> & { matches?: string[] }) => {
    const existing = signals.find((x) => x.id === s.id);
    if (existing) existing.matches.push(...(s.matches ?? []));
    else signals.push({ matches: [], ...s });
  };
  for (const p of pages) {
    const host = p.domain ?? p.url;
    const official = officialBrandFor(p.domain);
    if ((p.asksPassword || p.asksPayment) && !official) {
      add({ id: 'page_sensitive_form', group: 'page', label: 'Verlinkte Seite fragt Passwort oder Zahlungsdaten ab', weight: 0.5, categories: ['phishing'], matches: [host] });
    }
    if (p.formTargets.length) add({ id: 'page_foreign_form', group: 'page', label: 'Formular der Seite sendet an eine fremde Domain', weight: 0.35, categories: ['phishing'], matches: p.formTargets });
    if (p.domainAgeDays != null && p.domainAgeDays < 30) {
      add({ id: 'page_new_domain', group: 'page_age', label: `Domain erst vor ${p.domainAgeDays} Tagen registriert`, weight: 0.45, categories: ['fake_shop', 'phishing'], matches: [host] });
    } else if (p.domainAgeDays != null && p.domainAgeDays < 180) {
      add({ id: 'page_young_domain', group: 'page_age', label: `Domain erst vor ${p.domainAgeDays} Tagen registriert`, weight: 0.2, categories: ['fake_shop'], matches: [host] });
    }
    if (p.looksLikeShop && p.hasImprint === false) add({ id: 'page_no_imprint', group: 'page', label: 'Shop ohne Impressum', weight: 0.3, categories: ['fake_shop'], matches: [host] });
    if (p.issues.some((i) => i.startsWith('Als Zahlungsart ist nur Vorkasse'))) {
      add({ id: 'page_prepayment_only', group: 'payment', label: 'Shop bietet nur Vorkasse/Überweisung an', weight: 0.3, categories: ['fake_shop'], matches: [host] });
    }
    if (p.issues.some((i) => i.startsWith('Zahlung per Krypto'))) {
      add({ id: 'page_risky_payment', group: 'payment', label: 'Seite verlangt Krypto oder Gutscheinkarten', weight: 0.4, categories: ['investment', 'fake_shop'], matches: [host] });
    }
    if (p.issues.some((i) => i.startsWith('Extreme Rabatte'))) add({ id: 'page_big_discount', group: 'too_good', label: 'Extreme Rabatte auf der Seite', weight: 0.25, categories: ['fake_shop'], matches: [host] });
    if (p.finalUrl && p.domain && p.domain !== parse(safeHost(p.url)).domain) {
      urls.push(analyzeUrl(p.finalUrl));
    }
  }
  return { signals, urls };
}

function safeHost(raw: string): string {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).hostname;
  } catch {
    return raw;
  }
}

export function toPublicPage({ text: _text, ...page }: PageInspection): PageFinding {
  return page;
}

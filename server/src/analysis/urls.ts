import { parse } from 'tldts';
import type { UrlFinding } from '../types.js';
import { BARE_DOMAIN_TLDS, BRANDS, PHISHY_HOST_WORDS, RISKY_TLDS, URL_SHORTENERS, type BrandInfo } from './rules.js';

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`´„“”()[\]{}]+|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"'`´„“”()[\]{}]*)?/giu;

const SHORT_TOKEN_SUFFIXES = new Set([
  'paket',
  'pakete',
  'sendung',
  'express',
  'support',
  'service',
  'zustellung',
  'tracking',
  'versand',
  'post',
  'delivery',
  'info',
  'help',
  'online',
  'kunden',
  'login',
  'secure',
  'de',
]);

/** Extracts URL-like strings from free text. Bare domains are only accepted for common TLDs. */
export function extractUrls(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0].replace(/[.,;:!?…]+$/u, '');
    if (!raw) continue;
    const hasScheme = /^https?:\/\//i.test(raw);
    if (!hasScheme && !/^www\./i.test(raw)) {
      const tld = raw.split('/')[0]!.split('.').pop()!.toLowerCase();
      if (!BARE_DOMAIN_TLDS.has(tld)) continue;
    }
    found.add(raw);
    if (found.size >= 15) break;
  }
  return [...found];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

const LEET: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };
const deLeet = (s: string) => s.replace(/[013457@$]/g, (c) => LEET[c] ?? c).replace(/rn/g, 'm').replace(/vv/g, 'w');

function hostMentionsBrand(host: string, brand: BrandInfo): boolean {
  const parts = host.split(/[.-]/).filter(Boolean);
  return brand.tokens.some((token) => {
    if (token.includes('-') || token.includes('.')) return host.includes(token);
    return parts.some((p) => {
      if (p === token) return true;
      if (token.length >= 5) return p.includes(token);
      return p.startsWith(token) && SHORT_TOKEN_SUFFIXES.has(p.slice(token.length));
    });
  });
}

function lookalikeBrand(domainLabel: string): BrandInfo | null {
  const normalized = deLeet(domainLabel);
  for (const brand of BRANDS) {
    for (const token of brand.tokens) {
      if (token.length < 5 || token.includes('-')) continue;
      if (domainLabel === token) continue;
      if (normalized === token && domainLabel !== token) return brand;
      if (domainLabel.length >= 5 && levenshtein(domainLabel, token) === 1) return brand;
    }
  }
  return null;
}

export function officialBrandFor(registrableDomain: string | null): BrandInfo | null {
  if (!registrableDomain) return null;
  return BRANDS.find((b) => b.official.test(registrableDomain)) ?? null;
}

/** Static analysis of a URL. Never fetches anything – the link might be malicious. */
export function analyzeUrl(raw: string): UrlFinding {
  const issues: string[] = [];
  const risks: number[] = [];
  const add = (risk: number, issue: string) => {
    risks.push(risk);
    issues.push(issue);
  };

  let url: URL | null = null;
  const explicitScheme = /^https?:\/\//i.test(raw);
  try {
    url = new URL(explicitScheme ? raw : `http://${raw}`);
  } catch {
    return { url: raw, host: raw, registrableDomain: null, risk: 0.2, issues: ['Link ist ungewöhnlich formatiert'] };
  }

  const host = url.hostname.toLowerCase();
  const info = parse(host);
  const domain = info.domain;
  const tld = info.publicSuffix ?? '';
  const official = officialBrandFor(domain);

  if (info.isIp) add(0.5, 'Link zeigt auf eine nackte IP-Adresse statt auf eine Domain');
  if (url.username || url.password || /@/.test(explicitScheme ? (raw.split('/')[2] ?? '') : '')) add(0.5, 'Link enthält ein „@“ – das echte Ziel steht dahinter');
  if (host.includes('xn--')) add(0.45, 'Domain mit Sonderzeichen (Punycode) – mögliche Doppelgänger-Buchstaben');
  const authority = explicitScheme ? (raw.split('/')[2] ?? '') : (raw.split('/')[0] ?? '');
  if (/[^\x00-\x7f]/.test(authority)) add(0.5, 'Domain enthält Sonderzeichen, die echte Buchstaben imitieren können');
  if (domain && URL_SHORTENERS.has(domain)) add(0.35, 'Link-Verkürzer verschleiert das eigentliche Ziel');
  if (domain === 'wa.me' || domain === 't.me') add(0.2, 'Link führt direkt in einen privaten Messenger-Chat');
  if (RISKY_TLDS.has(tld)) add(0.25, `Endung „.${tld}“ wird überdurchschnittlich oft für Betrugsseiten genutzt`);
  if (explicitScheme && url.protocol === 'http:') add(0.12, 'Unverschlüsselte Verbindung (http statt https)');

  if (!official && domain) {
    const impersonated = BRANDS.find((b) => hostMentionsBrand(host, b));
    if (impersonated) {
      add(0.6, `Enthält „${impersonated.name}“, gehört aber nicht zur offiziellen ${impersonated.name}-Domain`);
    } else {
      const label = domain.split('.')[0] ?? '';
      const look = lookalikeBrand(label);
      if (look) add(0.6, `„${domain}“ sieht aus wie ${look.name}, ist es aber nicht (Tippfehler-Domain)`);
    }
    const subdomainDepth = (info.subdomain ?? '').split('.').filter(Boolean).length;
    if (subdomainDepth >= 3) add(0.15, 'Ungewöhnlich viele Subdomains');
    const label = domain.split('.')[0] ?? '';
    if ((label.match(/-/g) ?? []).length >= 2) add(0.15, 'Viele Bindestriche in der Domain');
    const words = PHISHY_HOST_WORDS.filter((w) => host.includes(w));
    if (words.length) add(0.18, `Typische Lockwörter in der Domain: ${words.slice(0, 3).join(', ')}`);
    if (/\d{4,}/.test(label)) add(0.1, 'Domain enthält auffällige Zahlenfolgen');
  }

  const risk = risks.length ? Math.min(0.95, 1 - risks.reduce((acc, r) => acc * (1 - r), 1)) : 0;
  if (official && !issues.length) issues.push(`Offizielle Domain von ${official.name}`);

  return { url: raw.slice(0, 300), host, registrableDomain: domain, risk: Math.round(risk * 100) / 100, issues };
}

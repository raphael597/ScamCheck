import type { HeuristicSignal, ScamCategory, UrlFinding } from '../types.js';
import { BRANDS, RULES, type Rule } from './rules.js';
import { analyzeUrl, extractUrls, officialBrandFor } from './urls.js';

export interface HeuristicReport {
  score: number;
  signals: HeuristicSignal[];
  urls: UrlFinding[];
  category: ScamCategory;
  mentionedBrands: string[];
}

const compiled = new Map<string, RegExp[]>();
function patternsFor(rule: Rule): RegExp[] {
  let list = compiled.get(rule.id);
  if (!list) {
    list = rule.patterns.map((p) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${p})(?![\\p{L}\\p{N}])`, 'giu'));
    compiled.set(rule.id, list);
  }
  return list;
}

function snippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(text.length, index + length + 25);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

/** Noisy-OR with diminishing returns inside a group so that ten urgency words don't count ten times. */
function combine(signals: { group: string; weight: number }[]): number {
  const byGroup = new Map<string, number[]>();
  for (const s of signals) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s.weight]);
  let keep = 1;
  for (const weights of byGroup.values()) {
    weights.sort((a, b) => b - a);
    weights.forEach((w, i) => {
      keep *= 1 - w * (i === 0 ? 1 : 0.5 / i);
    });
  }
  return 1 - keep;
}

/**
 * @param text    the suspicious content itself
 * @param context optional notes from the person checking ("seller insists on prepayment") –
 *                scanned for patterns, but not for brand mentions or links
 */
export function runHeuristics(text: string, context = ''): HeuristicReport {
  const signals: HeuristicSignal[] = [];
  const lower = text.toLowerCase();
  const scanned = context.trim() ? `${text}\n${context}` : text;

  for (const rule of RULES) {
    const matches: string[] = [];
    let distinctPatterns = 0;
    for (const re of patternsFor(rule)) {
      re.lastIndex = 0;
      let hit = false;
      for (const m of scanned.matchAll(re)) {
        hit = true;
        if (matches.length >= 3) break;
        const s = snippet(scanned, m.index ?? 0, m[0].length);
        if (!matches.includes(s)) matches.push(s);
      }
      if (hit) distinctPatterns++;
    }
    if (matches.length) {
      // Several different patterns of the same scheme are stronger evidence than one.
      const weight = Math.min(0.9, rule.weight + (1 - rule.weight) * rule.weight * 0.5 * Math.min(2, distinctPatterns - 1));
      signals.push({ id: rule.id, group: rule.group, label: rule.label, weight: Math.round(weight * 100) / 100, matches, categories: rule.categories });
    }
  }

  // Shouting: lots of capitals or exclamation marks.
  const letters = text.match(/\p{L}/gu) ?? [];
  const upper = text.match(/\p{Lu}/gu) ?? [];
  const exclamations = (text.match(/!/g) ?? []).length;
  if ((letters.length > 40 && upper.length / letters.length > 0.35) || /!{3,}/.test(text) || exclamations >= 5) {
    signals.push({
      id: 'shouting',
      group: 'style',
      label: 'Auffällige Großschreibung oder viele Ausrufezeichen',
      weight: 0.12,
      matches: [],
      categories: [],
    });
  }
  if (/[💰💸🤑🚀🔥💎📈]/u.test(text) && signals.some((s) => s.group === 'too_good')) {
    signals.push({ id: 'money_emojis', group: 'style', label: 'Geld- und Hype-Emojis', weight: 0.08, matches: [], categories: ['investment'] });
  }

  // Links
  const urls = extractUrls(text).map(analyzeUrl);
  const risky = urls.filter((u) => u.risk >= 0.25).sort((a, b) => b.risk - a.risk);
  if (risky.length) {
    signals.push({
      id: 'risky_links',
      group: 'links',
      label: risky.length === 1 ? 'Verdächtiger Link' : `${risky.length} verdächtige Links`,
      weight: Math.min(0.7, risky[0]!.risk),
      matches: risky.slice(0, 3).map((u) => u.host),
      categories: [],
    });
  }

  // Brand mentioned in text but links go somewhere else.
  const mentionedBrands = BRANDS.filter((b) => !b.platform).filter((b) =>
    b.textPatterns.some((p) => new RegExp(`(?<![\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(lower)),
  );
  if (mentionedBrands.length && urls.length) {
    const foreign = urls.filter((u) => u.registrableDomain && !officialBrandFor(u.registrableDomain) && !u.issues.some((i) => i.startsWith('Offizielle')));
    const brandsWithOfficialLink = new Set(urls.map((u) => officialBrandFor(u.registrableDomain)?.name).filter(Boolean));
    const impersonated = mentionedBrands.filter((b) => !brandsWithOfficialLink.has(b.name));
    if (foreign.length && impersonated.length) {
      signals.push({
        id: 'brand_link_mismatch',
        group: 'links',
        label: `Nennt ${impersonated[0]!.name}, der Link führt aber zu einer fremden Domain`,
        weight: 0.5,
        matches: foreign.slice(0, 2).map((u) => u.registrableDomain ?? u.host),
        categories: ['phishing', 'impersonation'],
      });
    }
  }

  const score = Math.round(combine(signals) * 100);

  const categoryWeights = new Map<ScamCategory, number>();
  for (const s of signals) {
    for (const c of s.categories) {
      if (c === 'other') continue;
      categoryWeights.set(c, (categoryWeights.get(c) ?? 0) + s.weight);
    }
  }
  const top = [...categoryWeights.entries()].sort((a, b) => b[1] - a[1])[0];
  const category: ScamCategory = score < 20 ? 'none' : (top?.[0] ?? 'other');

  signals.sort((a, b) => b.weight - a.weight);
  return { score, signals, urls, category, mentionedBrands: mentionedBrands.map((b) => b.name) };
}

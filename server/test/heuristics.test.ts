import { describe, expect, it } from 'vitest';
import { runHeuristics } from '../src/analysis/heuristics.js';
import { heuristicVerdict } from '../src/analysis/playbook.js';
import { DEMO_CASES } from '../src/demo/cases.js';

describe('pattern engine', () => {
  it.each(DEMO_CASES.filter((c) => c.sample.verdict !== 'safe').map((c) => [c.id, c] as const))('flags scam demo case %s', (_id, demo) => {
    const report = runHeuristics(demo.text, demo.context);
    expect(report.score).toBeGreaterThanOrEqual(50);
    expect(report.signals.length).toBeGreaterThan(0);
  });

  it('keeps a normal marketplace inquiry calm', () => {
    const demo = DEMO_CASES.find((c) => c.id === 'echte-anfrage')!;
    const report = runHeuristics(demo.text, demo.context);
    expect(report.score).toBeLessThan(20);
    expect(report.category).toBe('none');
  });

  it('detects the category of well-known schemes', () => {
    const byId = (id: string) => DEMO_CASES.find((c) => c.id === id)!;
    expect(runHeuristics(byId('hallo-mama').text).category).toBe('family_emergency');
    expect(runHeuristics(byId('kleinanzeigen-sicher-bezahlen').text).category).toBe('marketplace');
    expect(runHeuristics(byId('krypto-promi').text).category).toBe('investment');
    expect(runHeuristics(byId('wohnung').text).category).toBe('rental');
  });

  it('understands umlauts at word boundaries', () => {
    const report = runHeuristics('Bitte überweisen Sie die Bearbeitungsgebühr unverzüglich per Western Union.');
    const ids = report.signals.map((s) => s.id);
    expect(ids).toContain('urgency');
    expect(ids).toContain('money_transfer');
    expect(ids).toContain('prepayment');
  });

  it('flags gift card payment and code requests strongly', () => {
    const report = runHeuristics('Kaufen Sie vier Google Play Karten und schicken Sie mir die Codes. Nennen Sie mir auch den SMS-Code.');
    expect(report.signals.map((s) => s.id)).toEqual(expect.arrayContaining(['gift_cards', 'credentials']));
    expect(report.score).toBeGreaterThanOrEqual(75);
  });

  it('records evidence snippets for matches', () => {
    const report = runHeuristics('Ihr Konto wird gesperrt, wenn Sie nicht innerhalb von 24 Stunden reagieren.');
    const urgency = report.signals.find((s) => s.id === 'urgency');
    expect(urgency?.matches[0]).toContain('innerhalb von 24 Stunden');
  });

  it('ignores brand names that only appear in the user context', () => {
    const report = runHeuristics('Nur Vorkasse. www.super-deals-outlet.shop', 'Gefunden über Facebook und DHL Werbung');
    expect(report.signals.map((s) => s.id)).not.toContain('brand_link_mismatch');
  });

  it('never claims "safe" without AI', () => {
    const demo = DEMO_CASES.find((c) => c.id === 'echte-anfrage')!;
    const verdict = heuristicVerdict(runHeuristics(demo.text), 'marketplace');
    expect(verdict.verdict).toBe('unclear');
    expect(verdict.recommendations.length).toBeGreaterThan(0);
  });
});

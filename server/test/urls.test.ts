import { describe, expect, it } from 'vitest';
import { analyzeUrl, extractUrls } from '../src/analysis/urls.js';

describe('extractUrls', () => {
  it('finds links with and without scheme', () => {
    const urls = extractUrls('Hier: https://example.com/a?b=1, oder www.test.de. Und paypal-login.info/verify!');
    expect(urls).toEqual(['https://example.com/a?b=1', 'www.test.de', 'paypal-login.info/verify']);
  });

  it('ignores e-mail addresses, abbreviations and file names', () => {
    expect(extractUrls('Schreib an max@mustermann.de, z.B. heute. Anhang: rechnung.zip')).toEqual([]);
  });
});

describe('analyzeUrl', () => {
  it('trusts official brand domains', () => {
    const r = analyzeUrl('https://www.dhl.de/de/privatkunden.html');
    expect(r.risk).toBe(0);
    expect(r.issues[0]).toContain('Offizielle Domain von DHL');
  });

  it('flags brand names on foreign domains', () => {
    const r = analyzeUrl('https://dhl-zustellung.paket-hilfe.info/de');
    expect(r.registrableDomain).toBe('paket-hilfe.info');
    expect(r.risk).toBeGreaterThanOrEqual(0.6);
    expect(r.issues.join(' ')).toContain('DHL');
  });

  it('detects typo-squatting', () => {
    expect(analyzeUrl('https://paypa1.com/login').issues.join(' ')).toContain('PayPal');
    expect(analyzeUrl('https://amazom.de').issues.join(' ')).toContain('Amazon');
  });

  it('flags shorteners, IP hosts, punycode and @-tricks', () => {
    expect(analyzeUrl('https://bit.ly/3abc').risk).toBeGreaterThan(0.3);
    expect(analyzeUrl('http://192.168.10.5/login').risk).toBeGreaterThanOrEqual(0.5);
    expect(analyzeUrl('https://xn--pypal-4ve.com').risk).toBeGreaterThanOrEqual(0.45);
    expect(analyzeUrl('https://www.sparkasse.de@evil.example.com/').risk).toBeGreaterThanOrEqual(0.5);
  });

  it('accepts regional Sparkasse domains as official', () => {
    expect(analyzeUrl('https://www.sparkasse-koelnbonn.de').risk).toBe(0);
  });

  it('does not treat words inside unrelated hosts as brands', () => {
    expect(analyzeUrl('https://www.groups-upsilon.de').issues.join(' ')).not.toContain('UPS');
  });
});

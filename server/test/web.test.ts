import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractPageFacts, inspectPage, pageEvidence, parseRdapCreated } from '../src/web/inspectPage.js';
import { isBlockedAddress, safeFetch } from '../src/web/safeFetch.js';
import { makeTestApp } from './helpers.js';

const SHOP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Küchen-Outlet – Thermomix -83 %</title>
<meta name="description" content="Nur heute: Markengeräte zum Bestpreis"></head>
<body><nav><a href="/kontakt">Kontakt</a><a href="/agb">AGB</a></nav>
<h1>Thermomix TM6</h1><p>Statt 1.499 € nur 249 € – -83 % Rabatt! In den Warenkorb. Versandkosten: 0 €.</p>
<p>Zahlung: Vorkasse per Banküberweisung (5 % Extra-Rabatt).</p>
<script>var tracking = "Impressum PayPal";</script>
<form action="https://collect.evil-forms.example/submit"><input type="text" name="cardnumber"><input type="password" name="pw"></form>
</body></html>`;

const LEGIT_HTML = `<html><head><title>Fahrradladen Müller</title></head><body>
<a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a>
<p>Unsere Räder gibt es mit PayPal, Kreditkarte oder Kauf auf Rechnung. In den Warenkorb legen und bequem bestellen.</p>
${'<p>Viel Text über Fahrräder und Service. </p>'.repeat(20)}
</body></html>`;

let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case '/shop':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(SHOP_HTML);
      case '/legit':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' });
        return res.end(zlib.gzipSync(LEGIT_HTML));
      case '/latin1':
        res.writeHead(200, { 'content-type': 'text/html; charset=iso-8859-1' });
        return res.end(Buffer.from('<title>Grüße</title><p>Größe</p>', 'latin1'));
      case '/hop':
        res.writeHead(302, { location: '/shop' });
        return res.end();
      case '/meta-refresh':
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<meta http-equiv="refresh" content="0; url=/legit"><p>Bitte warten …</p>');
      case '/loop':
        res.writeHead(302, { location: '/loop' });
        return res.end();
      case '/zip':
        res.writeHead(200, { 'content-type': 'application/zip' });
        return res.end(Buffer.alloc(100));
      case '/huge':
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<title>Groß</title>${'x'.repeat(3_000_000)}`);
      default:
        res.writeHead(404, { 'content-type': 'text/html' });
        return res.end('<title>Nicht gefunden</title>');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

describe('SSRF protection', () => {
  it('blocks private, loopback, link-local and reserved addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.178.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fd00::5', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ['93.184.216.34', '1.1.1.1', '2606:4700::6810:622', '::ffff:8.8.8.8']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it('refuses to open local targets, odd ports and other schemes', async () => {
    await expect(safeFetch(`${base}/shop`)).rejects.toThrow(/Port|internen Netz/);
    await expect(safeFetch('http://127.0.0.1/')).rejects.toThrow(/internen Netz/);
    await expect(safeFetch('http://localhost/')).rejects.toThrow(/Interne Hostnamen/);
    await expect(safeFetch('http://[::1]/')).rejects.toThrow(/internen Netz/);
    await expect(safeFetch('ftp://example.org/x')).rejects.toThrow(/http/);
    await expect(safeFetch('http://user:pw@example.org/')).rejects.toThrow(/Zugangsdaten/);
  });

  it('reports blocked links as page errors instead of crashing', async () => {
    const page = await inspectPage('http://127.0.0.1/admin');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/internen Netz/);
  });
});

describe('page inspection', () => {
  const opts = { allowPrivate: true };

  it('extracts shop facts and suspicious forms', async () => {
    const page = await inspectPage(`${base}/shop`, opts);
    expect(page.ok).toBe(true);
    expect(page.title).toBe('Küchen-Outlet – Thermomix -83 %');
    expect(page.looksLikeShop).toBe(true);
    expect(page.hasImprint).toBe(false); // "Impressum" only appears inside a script
    expect(page.hasTerms).toBe(true);
    expect(page.paymentMethods).toEqual(['Vorkasse/Überweisung']);
    expect(page.asksPassword).toBe(true);
    expect(page.asksPayment).toBe(true);
    expect(page.formTargets).toEqual(['evil-forms.example']);
    expect(page.issues.join(' ')).toMatch(/Kein Impressum/);
    expect(page.issues.join(' ')).toMatch(/nur Vorkasse/);
    expect(page.issues.join(' ')).toMatch(/Extreme Rabatte/);
    expect(page.text).toContain('Thermomix TM6');
    expect(page.text).not.toContain('tracking');
  });

  it('recognises a normal shop with imprint and buyer protection', async () => {
    const page = await inspectPage(`${base}/legit`, opts);
    expect(page.hasImprint).toBe(true);
    expect(page.hasPrivacy).toBe(true);
    expect(page.paymentMethods).toEqual(expect.arrayContaining(['PayPal', 'Kreditkarte', 'Kauf auf Rechnung']));
    expect(page.issues).toEqual([]);
  });

  it('decodes legacy charsets', async () => {
    const page = await inspectPage(`${base}/latin1`, opts);
    expect(page.title).toBe('Grüße');
  });

  it('follows HTTP and meta-refresh redirects and records the chain', async () => {
    const page = await inspectPage(`${base}/hop`, opts);
    expect(page.finalUrl).toBe(`${base}/shop`);
    expect(page.redirects).toEqual([`${base}/hop`]);
    const meta = await inspectPage(`${base}/meta-refresh`, opts);
    expect(meta.finalUrl).toBe(`${base}/legit`);
    expect(meta.redirects).toContain(`${base}/meta-refresh`);
  });

  it('stops redirect loops, non-HTML content and oversized pages', async () => {
    expect((await inspectPage(`${base}/loop`, opts)).error).toMatch(/Weiterleitungen/);
    expect((await inspectPage(`${base}/zip`, opts)).error).toMatch(/Inhaltstyp/);
    const huge = await inspectPage(`${base}/huge`, opts);
    expect(huge.ok).toBe(true);
    expect(huge.title).toBe('Groß');
  });

  it('turns findings into pattern-engine signals', async () => {
    const page = await inspectPage(`${base}/shop`, opts);
    const { signals } = pageEvidence([{ ...page, domainAgeDays: 9, domainCreated: new Date().toISOString() }]);
    expect(signals.map((s) => s.id)).toEqual(
      expect.arrayContaining(['page_sensitive_form', 'page_foreign_form', 'page_new_domain', 'page_no_imprint', 'page_prepayment_only', 'page_big_discount']),
    );
  });

  it('reads the registration date from RDAP responses', () => {
    expect(parseRdapCreated({ events: [{ eventAction: 'last changed', eventDate: '2026-01-01T00:00:00Z' }, { eventAction: 'registration', eventDate: '2026-09-20T10:00:00Z' }] })).toBe(
      '2026-09-20T10:00:00.000Z',
    );
    expect(parseRdapCreated({ events: [] })).toBeNull();
    expect(parseRdapCreated(null)).toBeNull();
  });

  it('finds imprint links by text as well as by URL', () => {
    expect(extractPageFacts('<a href="/legal">Impressum</a>', 'https://shop.example/').hasImprint).toBe(true);
    expect(extractPageFacts('<a href="/de/imprint">Legal</a>', 'https://shop.example/').hasImprint).toBe(true);
  });
});

describe('check API with page inspection', () => {
  it('opens the link, includes the page in the result and feeds the AI context', async () => {
    const { app } = makeTestApp({ fetchPages: true });
    const res = await request(app).post('/api/check').field('text', `Super Angebot: ${base}/shop`).field('platform', 'shop');
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(1);
    const page = res.body.pages[0];
    expect(page.hasImprint).toBe(false);
    expect(page.text).toBeUndefined(); // page text stays on the server
    expect(res.body.signals.map((s: { id: string }) => s.id)).toContain('page_sensitive_form');
    expect(res.body.riskScore).toBeGreaterThanOrEqual(65);
  });

  it('does not open links when the feature is switched off', async () => {
    const { app } = makeTestApp({ fetchPages: false });
    const res = await request(app).post('/api/check').field('text', `${base}/shop`);
    expect(res.body.pages).toEqual([]);
  });
});

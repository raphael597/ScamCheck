import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/news/classify.js';
import { stripHtml } from '../src/news/aggregator.js';
import { makeTestApp } from './helpers.js';

const now = new Date().toUTCString();
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Test</title>
<item><title>Phishing-Welle: Gefälschte Sparkassen-Mails im Umlauf</title><link>https://example.org/a</link><pubDate>${now}</pubDate>
<description><![CDATA[<p>Betrüger verschicken <b>gefälschte</b> E-Mails &amp; SMS.</p>]]></description>
<media:content url="https://example.org/a.jpg" medium="image"/></item>
<item><title>Kritische Sicherheitslücke in Browser geschlossen</title><link>https://example.org/b</link><pubDate>${now}</pubDate>
<description>Ein Update behebt eine Zero-Day-Lücke.</description></item>
<item><title>Uralte Meldung</title><link>https://example.org/old</link><pubDate>Mon, 01 Jan 2018 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry><title>Ransomware legt Klinik lahm</title><link href="https://example.net/r"/><updated>${new Date().toISOString()}</updated>
<summary>Ein Trojaner hat Systeme verschlüsselt.</summary></entry>
<entry><title>Phishing-Welle: Gefälschte Sparkassen-Mails im Umlauf</title><link href="https://example.net/dup"/><updated>${new Date().toISOString()}</updated></entry>
</feed>`;

const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);

const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes('rss.test')) return new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } });
  if (url.includes('atom.test')) return new Response(ATOM, { headers: { 'content-type': 'application/atom+xml' } });
  if (url.endsWith('a.jpg')) return new Response(IMAGE, { headers: { 'content-type': 'image/jpeg' } });
  return new Response('nope', { status: 503 });
};

describe('news aggregator', () => {
  it('parses RSS and Atom, classifies, dedupes and reports source status', async () => {
    const { app, ctx } = makeTestApp({ fetchImpl: fakeFetch });
    ctx.settings.update({
      news: {
        feeds: [
          { id: 'rss', name: 'RSS Quelle', url: 'https://rss.test/feed', lang: 'de', kind: 'consumer', enabled: true },
          { id: 'atom', name: 'Atom Quelle', url: 'https://atom.test/feed', lang: 'de', kind: 'tech', enabled: true },
          { id: 'down', name: 'Kaputt', url: 'https://down.test/feed', lang: 'en', kind: 'tech', enabled: true },
          { id: 'off', name: 'Aus', url: 'https://off.test/feed', lang: 'en', kind: 'tech', enabled: false },
        ],
      },
    });
    await ctx.news.refresh();

    const res = await request(app).get('/api/news');
    expect(res.body.isSample).toBe(false);
    const titles = res.body.items.map((i: { title: string }) => i.title);
    expect(titles).toHaveLength(3);
    expect(titles).not.toContain('Uralte Meldung');

    const phishing = res.body.items.find((i: { title: string }) => i.title.startsWith('Phishing'));
    expect(phishing.summary).toBe('Betrüger verschicken gefälschte E-Mails & SMS.');
    expect(phishing.topics).toEqual(expect.arrayContaining(['phishing', 'scam']));
    expect(phishing.isWarning).toBe(true);
    expect(phishing.hasImage).toBe(true);
    expect(phishing.image).toBeUndefined();

    const status = Object.fromEntries(res.body.sources.map((s: { id: string; ok: boolean | null }) => [s.id, s.ok]));
    expect(status).toEqual({ rss: true, atom: true, down: false, off: null });

    const filtered = await request(app).get('/api/news?topic=malware');
    expect(filtered.body.items.map((i: { title: string }) => i.title)).toEqual(['Ransomware legt Klinik lahm']);

    const img = await request(app).get(`/api/news/image/${phishing.id}`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
  });

  it('refuses AI explanations when no provider is configured', async () => {
    const { app } = makeTestApp();
    const list = await request(app).get('/api/news');
    const res = await request(app).post(`/api/news/${list.body.items[0].id}/explain`);
    expect(res.status).toBe(409);
  });
});

describe('helpers', () => {
  it('strips HTML and decodes entities', () => {
    expect(stripHtml('<p>Hallo&nbsp;<b>Welt</b> &#8211; &quot;x&quot;</p><script>alert(1)</script>')).toBe('Hallo Welt – "x"');
  });

  it('classifies German and English headlines', () => {
    expect(classify('Neue Abzocke mit Fake-Shops')).toContain('scam');
    expect(classify('Critical zero-day vulnerability patched')).toContain('vulnerability');
    expect(classify('Datenleck bei Online-Händler')).toContain('breach');
  });
});

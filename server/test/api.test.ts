import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, makeTestApp } from './helpers.js';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Minimal fake of the OpenAI chat completions endpoint. */
function startFakeOpenAi() {
  const requests: Record<string, unknown>[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}') as Record<string, unknown>;
      requests.push({ ...parsed, _auth: req.headers.authorization, _path: req.url });
      const content = JSON.stringify({
        riskScore: 92,
        verdict: 'scam',
        confidence: 'high',
        category: 'phishing',
        headline: 'Das ist Phishing.',
        summary: 'Gefälschte Paketbenachrichtigung.',
        redFlags: [{ title: 'Fremde Domain', detail: 'Nicht dhl.de', evidence: 'paket-hilfe.info', severity: 'high' }],
        greenFlags: [],
        recommendations: ['Nicht klicken.'],
        ifAlreadyInteracted: ['Bank anrufen.'],
        questionsToVerify: [],
        extractedText: '',
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }));
    });
  });
  return new Promise<{ url: string; requests: typeof requests; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/v1`, requests, close: () => server.close() });
    });
  });
}

describe('public API (pattern engine only)', () => {
  const { app } = makeTestApp();

  it('reports health and meta', async () => {
    expect((await request(app).get('/api/health')).body).toMatchObject({ ok: true });
    const meta = await request(app).get('/api/meta');
    expect(meta.body.ai.ready).toBe(false);
    expect(meta.body.limits.maxImages).toBeGreaterThan(0);
  });

  it('checks a text without AI', async () => {
    const res = await request(app)
      .post('/api/check')
      .field('text', 'Ihr Paket konnte nicht zugestellt werden. Zahlen Sie 1,99 € Zollgebühr: https://dhl-paket.zoll-info.top/pay')
      .field('platform', 'sms');
    expect(res.status).toBe(200);
    expect(res.body.engine.mode).toBe('heuristic');
    expect(res.body.riskScore).toBeGreaterThanOrEqual(65);
    expect(['likely_scam', 'scam']).toContain(res.body.verdict);
    expect(res.body.urls[0].registrableDomain).toBe('zoll-info.top');
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  it('explains that screenshots need AI', async () => {
    const res = await request(app).post('/api/check').attach('images', PNG_1PX, 'shot.png');
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('unclear');
    expect(res.body.engine.fallbackReason).toContain('Screenshots');
  });

  it('validates input', async () => {
    expect((await request(app).post('/api/check').field('text', '   ')).status).toBe(400);
    const fake = await request(app).post('/api/check').attach('images', Buffer.from('not an image at all'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.error).toContain('kein gültiges Bild');
  });

  it('lists and runs demo cases with sample results', async () => {
    const list = await request(app).get('/api/demo');
    expect(list.body.cases.length).toBeGreaterThanOrEqual(8);
    const run = await request(app).post('/api/demo/hallo-mama/run').send({ mode: 'auto' });
    expect(run.body.engine.mode).toBe('demo');
    expect(run.body.category).toBe('family_emergency');
    expect(run.body.signals.length).toBeGreaterThan(0);
    expect((await request(app).post('/api/demo/does-not-exist/run')).status).toBe(404);
  });

  it('serves sample news when no feed was loaded', async () => {
    const res = await request(app).get('/api/news?warnings=1');
    expect(res.body.isSample).toBe(true);
    expect(res.body.items.every((i: { isWarning: boolean }) => i.isWarning)).toBe(true);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('limits checks per IP', async () => {
    const { app } = makeTestApp({ checksPerHour: 2 });
    const send = () => request(app).post('/api/check').field('text', 'Hallo, ist das Fahrrad noch da?');
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    const third = await send();
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeTruthy();
  });
});

describe('admin', () => {
  const { app, dataDir } = makeTestApp();

  it('rejects unauthenticated access and wrong passwords', async () => {
    expect((await request(app).get('/api/admin/settings')).status).toBe(401);
    expect((await request(app).post('/api/admin/login').send({ password: 'falsch' })).status).toBe(401);
  });

  it('logs in, stores the API key encrypted and masks it', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/admin/login').send({ password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly');

    const put = await agent.put('/api/admin/settings').send({ llm: { provider: 'openai', apiKey: 'sk-test-1234567890abcd', model: 'gpt-4.1-mini' } });
    expect(put.status).toBe(200);
    expect(put.body.llm).toMatchObject({ provider: 'openai', hasApiKey: true, apiKeyHint: '••••abcd' });
    expect(JSON.stringify(put.body)).not.toContain('sk-test-1234567890abcd');

    const onDisk = fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8');
    expect(onDisk).not.toContain('sk-test-1234567890abcd');
    expect(onDisk).toContain('apiKeyEnc');

    const meta = await request(app).get('/api/meta');
    expect(meta.body.ai).toMatchObject({ ready: true, provider: 'openai', model: 'gpt-4.1-mini' });
  });

  it('rejects invalid settings', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ password: ADMIN_PASSWORD });
    expect((await agent.put('/api/admin/settings').send({ llm: { provider: 'skynet' } })).status).toBe(400);
    expect((await agent.put('/api/admin/settings').send({ news: { refreshMinutes: 1 } })).status).toBe(400);
  });

  it('respects settings locked by environment variables', async () => {
    const { app: lockedApp } = makeTestApp({ env: { OPENAI_API_KEY: 'sk-env-key-9999', LLM_MODEL: 'gpt-env' } });
    const agent = request.agent(lockedApp);
    await agent.post('/api/admin/login').send({ password: ADMIN_PASSWORD });
    const settings = await agent.get('/api/admin/settings');
    expect(settings.body.locked).toEqual(expect.arrayContaining(['llm.provider', 'llm.apiKey', 'llm.model']));
    expect(settings.body.llm).toMatchObject({ provider: 'openai', model: 'gpt-env', apiKeyHint: '••••9999' });
    expect((await agent.put('/api/admin/settings').send({ llm: { model: 'other' } })).status).toBe(409);
  });
});

describe('AI analysis via OpenAI-compatible API', () => {
  let fake: Awaited<ReturnType<typeof startFakeOpenAi>>;
  beforeAll(async () => {
    fake = await startFakeOpenAi();
  });
  afterAll(() => fake.close());

  it('sends the system prompt, signals and images, and returns the model verdict', async () => {
    const { app, ctx } = makeTestApp();
    ctx.settings.update({ llm: { provider: 'openai_compatible', baseUrl: fake.url, model: 'local-model', apiKey: 'local-key' } });

    const res = await request(app)
      .post('/api/check')
      .field('text', 'DHL: Paket wartet. Bestätigen Sie Ihre Adresse: https://dhl-zustellung.paket-hilfe.info')
      .field('platform', 'sms')
      .attach('images', PNG_1PX, 'shot.png');

    expect(res.status).toBe(200);
    expect(res.body.engine).toMatchObject({ mode: 'ai', provider: 'openai_compatible', model: 'local-model' });
    expect(res.body.verdict).toBe('scam');
    expect(res.body.categoryLabel).toBe('Phishing / Datenklau');
    expect(res.body.signals.length).toBeGreaterThan(0);

    const sent = fake.requests.at(-1)!;
    expect(sent._path).toBe('/v1/chat/completions');
    expect(sent._auth).toBe('Bearer local-key');
    const messages = sent.messages as { role: string; content: unknown }[];
    expect(messages[0]!.content).toContain('Sicherheitsregeln');
    const userParts = messages[1]!.content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(userParts[0]!.text).toContain('<<<INHALT');
    expect(userParts[0]!.text).toContain('Statische Link-Analyse');
    expect(userParts[1]!.image_url!.url).toMatch(/^data:image\/png;base64,/);
  });

  it('uses strict JSON schema for the official OpenAI provider', async () => {
    const { app, ctx } = makeTestApp();
    ctx.settings.update({ llm: { provider: 'openai', baseUrl: fake.url, model: 'gpt-4.1-mini', apiKey: 'sk-x' } });
    await request(app).post('/api/check').field('text', 'Test Nachricht mit Paysafecard');
    const sent = fake.requests.at(-1)!;
    expect(sent.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true, name: 'scam_check_result' } });
    expect(sent.max_completion_tokens).toBeGreaterThan(0);
  });

  it('falls back to the pattern engine when the provider fails', async () => {
    const { app, ctx } = makeTestApp();
    ctx.settings.update({ llm: { provider: 'openai_compatible', baseUrl: 'http://127.0.0.1:9/v1', model: 'x', timeoutSeconds: 10 } });
    const res = await request(app).post('/api/check').field('text', 'Zahlen Sie mit Google Play Karten!');
    expect(res.status).toBe(200);
    expect(res.body.engine.mode).toBe('heuristic');
    expect(res.body.engine.fallbackReason).toContain('Verbindung');
  });

  it('runs demo cases live when AI is configured', async () => {
    const { app, ctx } = makeTestApp();
    ctx.settings.update({ llm: { provider: 'openai_compatible', baseUrl: fake.url, model: 'local-model' } });
    const res = await request(app).post('/api/demo/paket-sms/run').send({ mode: 'auto' });
    expect(res.body.engine.mode).toBe('ai');
    const sample = await request(app).post('/api/demo/paket-sms/run').send({ mode: 'sample' });
    expect(sample.body.engine.mode).toBe('demo');
  });
});

describe('AI analysis via Anthropic API', () => {
  it('sends structured output config, images and no sampling parameters', async () => {
    const requests: { path?: string; key?: string; body: Record<string, unknown> }[] = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        requests.push({ path: req.url, key: req.headers['x-api-key'] as string, body: JSON.parse(body) });
        const text = JSON.stringify({ riskScore: 30, verdict: 'unclear', confidence: 'low', category: 'none', headline: 'Unklar.', summary: 'Zu wenig Infos.' });
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5-5',
            content: [{ type: 'text', text }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 10 },
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    try {
      const { app, ctx } = makeTestApp();
      ctx.settings.update({ llm: { provider: 'anthropic', apiKey: 'sk-ant-test', baseUrl: `http://127.0.0.1:${port}` } });
      const res = await request(app).post('/api/check').field('text', 'Hallo, wie geht es dir?').attach('images', PNG_1PX, 'a.png');
      expect(res.body.engine).toMatchObject({ mode: 'ai', provider: 'anthropic', model: 'claude-opus-5-5' });
      expect(res.body.verdict).toBe('unclear');

      const sent = requests.at(-1)!;
      expect(sent.path).toContain('/v1/messages');
      expect(sent.key).toBe('sk-ant-test');
      expect(sent.body.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
      expect(sent.body.temperature).toBeUndefined();
      // Server-side fallbacks are only requested from the official API, not from custom base URLs.
      expect(sent.body.fallbacks).toBeUndefined();
      const content = (sent.body.messages as { content: { type: string }[] }[])[0]!.content;
      expect(content.map((c) => c.type)).toEqual(['image', 'text']);
    } finally {
      server.close();
    }
  });
});

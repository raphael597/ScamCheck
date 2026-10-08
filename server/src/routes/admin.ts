import { Router, type Request } from 'express';
import { z } from 'zod';
import { systemPrompt } from '../analysis/analyze.js';
import type { AppContext } from '../context.js';
import { createLlmClient, loadPrompt, PROVIDERS, type LlmConfig } from '../llm/index.js';
import { ADMIN_COOKIE } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { settingsUpdateSchema } from '../store/settings.js';

const draftSchema = z
  .object({
    provider: z.enum(PROVIDERS),
    apiKey: z.string().max(500),
    model: z.string().max(120),
    baseUrl: z.string().max(300),
    effort: z.enum(['low', 'medium', 'high']),
    vision: z.boolean(),
  })
  .partial();

export function adminRouter(ctx: AppContext): Router {
  const router = Router();
  const requireAdmin = ctx.auth.middleware();

  router.post('/admin/login', (req, res) => {
    ctx.limiters.login.enforce(req, res, 'Zu viele Anmeldeversuche.');
    const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body ?? {});
    if (!ctx.auth.verify(password)) throw new HttpError(401, 'Falsches Passwort.');
    const { token, expires } = ctx.auth.issue();
    res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: req.secure, expires, path: '/api' });
    res.json({ ok: true, expires: expires.toISOString() });
  });

  router.post('/admin/logout', (_req, res) => {
    res.clearCookie(ADMIN_COOKIE, { path: '/api' });
    res.json({ ok: true });
  });

  router.get('/admin/session', requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/admin/settings', requireAdmin, (_req, res) => {
    res.json(ctx.settings.toPublic(loadPrompt('scam-check.system.md')));
  });

  router.put('/admin/settings', requireAdmin, (req, res) => {
    const patch = settingsUpdateSchema.parse(req.body ?? {});
    const locked = new Set(ctx.settings.lockedFields);
    for (const [key, value] of Object.entries(patch.llm ?? {})) {
      if (value !== undefined && locked.has(`llm.${key}`)) throw new HttpError(409, `„${key}“ ist per Umgebungsvariable festgelegt und kann hier nicht geändert werden.`);
    }
    const feedsBefore = JSON.stringify(ctx.settings.feeds());
    const refreshBefore = ctx.settings.news.refreshMinutes;
    ctx.settings.update(patch);
    if (JSON.stringify(ctx.settings.feeds()) !== feedsBefore) void ctx.news.refresh();
    if (ctx.settings.news.refreshMinutes !== refreshBefore) ctx.news.schedule();
    res.json(ctx.settings.toPublic(loadPrompt('scam-check.system.md')));
  });

  /** Builds an LLM config from saved settings plus unsaved form values, so admins can test before saving. */
  const draftConfig = (req: Request): LlmConfig & { effort: 'low' | 'medium' | 'high' } => {
    const draft = draftSchema.parse(req.body?.llm ?? {});
    const current = ctx.settings.llmConfig();
    return {
      ...current,
      ...Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== undefined && !(k === 'apiKey' && v === ''))),
      timeoutMs: Math.min(current.timeoutMs, 60000),
    } as LlmConfig & { effort: 'low' | 'medium' | 'high' };
  };

  router.post('/admin/llm/test', requireAdmin, async (req, res) => {
    const cfg = draftConfig(req);
    const client = createLlmClient(cfg);
    if (!client) throw new HttpError(400, 'Bitte zuerst einen KI-Anbieter auswählen.');
    const started = Date.now();
    try {
      const reply = (await client.completeJson({
        system: 'Du bist ein Verbindungstest. Antworte ausschließlich mit JSON.',
        user: 'Antworte mit {"ok": true, "message": "<ein kurzer freundlicher deutscher Satz>"}',
        maxTokens: 300,
      })) as { ok?: boolean; message?: string };
      res.json({ ok: true, provider: client.provider, model: client.model, latencyMs: Date.now() - started, message: reply?.message ?? 'Verbindung erfolgreich.' });
    } catch (err) {
      res.json({ ok: false, provider: client.provider, model: client.model, latencyMs: Date.now() - started, message: (err as Error).message });
    }
  });

  router.post('/admin/llm/models', requireAdmin, async (req, res) => {
    const client = createLlmClient(draftConfig(req));
    if (!client) throw new HttpError(400, 'Bitte zuerst einen KI-Anbieter auswählen.');
    try {
      res.json({ models: await client.listModels() });
    } catch (err) {
      throw new HttpError(502, (err as Error).message);
    }
  });

  router.get('/admin/prompt', requireAdmin, (_req, res) => {
    res.json({ active: systemPrompt(ctx.settings), default: loadPrompt('scam-check.system.md'), isOverride: Boolean(ctx.settings.systemOverride) });
  });

  router.get('/admin/stats', requireAdmin, (_req, res) => {
    res.json(ctx.stats.snapshot());
  });

  router.get('/admin/news/sources', requireAdmin, (_req, res) => {
    res.json({ sources: ctx.news.sources() });
  });

  router.post('/admin/news/refresh', requireAdmin, async (_req, res) => {
    await ctx.news.refresh();
    res.json({ sources: ctx.news.sources() });
  });

  return router;
}

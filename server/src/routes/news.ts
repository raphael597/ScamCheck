import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { createLlmClient, loadPrompt } from '../llm/index.js';
import { HttpError } from '../middleware/errors.js';
import { TOPICS } from '../news/classify.js';

const querySchema = z.object({
  topic: z.enum(TOPICS).optional().catch(undefined),
  lang: z.enum(['de', 'en']).optional().catch(undefined),
  kind: z.enum(['consumer', 'tech', 'gov']).optional().catch(undefined),
  q: z.string().max(100).optional(),
  warnings: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
  offset: z.coerce.number().int().min(0).catch(0),
});

const explainSchema = z.object({
  summary: z.string().catch(''),
  affected: z.string().catch(''),
  actions: z.array(z.string()).catch([]),
});

export function newsRouter(ctx: AppContext): Router {
  const router = Router();
  const explained = new Map<string, z.infer<typeof explainSchema>>();

  router.get('/news', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(ctx.news.list(querySchema.parse(req.query)));
  });

  router.get('/news/image/:id', async (req, res) => {
    const img = await ctx.news.image(req.params.id).catch(() => null);
    if (!img) throw new HttpError(404, 'Kein Bild');
    res.setHeader('Content-Type', img.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(img.data);
  });

  router.post('/news/:id/explain', async (req, res) => {
    if (!ctx.settings.news.aiExplain || !ctx.settings.aiReady()) {
      throw new HttpError(409, 'Die KI-Erklärung ist auf diesem Server nicht aktiviert.');
    }
    const item = ctx.news.get(req.params.id);
    if (!item) throw new HttpError(404, 'Meldung nicht gefunden.');
    const cached = explained.get(item.id);
    if (cached) return res.json(cached);

    ctx.limiters.explain.enforce(req, res, 'Du hast das Limit für KI-Erklärungen erreicht.');
    const client = createLlmClient(ctx.settings.llmConfig());
    if (!client) throw new HttpError(409, 'Kein KI-Anbieter konfiguriert.');
    const raw = await client
      .completeJson({
        system: loadPrompt('news-explain.system.md'),
        user: `Quelle: ${item.source.name} (${item.source.lang === 'de' ? 'deutsch' : 'englisch'})\nDatum: ${item.publishedAt.slice(0, 10)}\n<<<ARTIKEL\nTitel: ${item.title}\nAnriss: ${item.summary}\nARTIKEL>>>`,
        maxTokens: 800,
      })
      .catch((err: Error) => {
        throw new HttpError(502, err.message);
      });
    const result = explainSchema.parse(raw);
    explained.set(item.id, result);
    if (explained.size > 500) explained.delete(explained.keys().next().value!);
    res.json(result);
  });

  return router;
}

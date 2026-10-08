import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { analyze } from '../analysis/analyze.js';
import { runHeuristics } from '../analysis/heuristics.js';
import type { AppContext } from '../context.js';
import { DEMO_CASES } from '../demo/cases.js';
import { HttpError } from '../middleware/errors.js';
import { CATEGORY_LABELS, VERDICT_LABELS, type AnalysisResult } from '../types.js';

export function demoRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/demo', (_req, res) => {
    res.json({
      aiReady: ctx.settings.aiReady(),
      cases: DEMO_CASES.map(({ sample, ...c }) => ({ ...c, expectedVerdict: sample.verdict })),
    });
  });

  const runSchema = z.object({ mode: z.enum(['auto', 'sample', 'live']).default('auto') });

  router.post('/demo/:id/run', async (req, res) => {
    const demo = DEMO_CASES.find((c) => c.id === req.params.id);
    if (!demo) throw new HttpError(404, 'Demo-Fall nicht gefunden.');
    const { mode } = runSchema.parse(req.body ?? {});
    const live = mode === 'live' || (mode === 'auto' && ctx.settings.aiReady());

    if (live) {
      if (!ctx.settings.aiReady()) throw new HttpError(409, 'Kein KI-Anbieter konfiguriert.');
      // Live runs cost API credits and therefore share the public rate limit.
      ctx.limiters.check.enforce(req, res, 'Du hast das Limit für Prüfungen erreicht.');
      const result = await analyze({ text: demo.text, context: demo.context, platform: demo.platform, images: [] }, ctx.settings);
      return res.json(result);
    }

    const started = Date.now();
    const report = runHeuristics(demo.text, demo.context);
    const result: AnalysisResult = {
      ...demo.sample,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      verdictLabel: VERDICT_LABELS[demo.sample.verdict],
      categoryLabel: CATEGORY_LABELS[demo.sample.category],
      signals: report.signals,
      urls: report.urls,
      heuristicScore: report.score,
      engine: { mode: 'demo', durationMs: Date.now() - started },
    };
    res.json(result);
  });

  return router;
}

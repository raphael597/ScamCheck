import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { analyze } from '../analysis/analyze.js';
import type { AppContext } from '../context.js';
import { HttpError } from '../middleware/errors.js';
import { PLATFORMS, type AnalysisInput } from '../types.js';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Verifies the file really is the image type it claims to be. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function checkRouter(ctx: AppContext): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: ctx.config.maxImages, fileSize: ctx.config.maxImageBytes, fields: 10, fieldSize: ctx.config.maxTextChars * 4 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
      else cb(new HttpError(400, 'Bitte nur Bilder im Format PNG, JPG, WebP oder GIF hochladen.'));
    },
  });

  const bodySchema = z.object({
    text: z.string().max(ctx.config.maxTextChars, `Der Text ist zu lang (max. ${ctx.config.maxTextChars} Zeichen).`).default(''),
    context: z.string().max(2000, 'Die Zusatzinfo ist zu lang (max. 2000 Zeichen).').default(''),
    platform: z.enum(PLATFORMS).catch('unknown'),
  });

  router.post('/check', ctx.limiters.check.middleware('Du hast das Limit für Prüfungen erreicht.'), upload.array('images', ctx.config.maxImages), async (req, res) => {
    const body = bodySchema.parse(req.body ?? {});
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const images: AnalysisInput['images'] = [];
    for (const f of files) {
      const type = sniffImage(f.buffer);
      if (!type) throw new HttpError(400, `„${f.originalname}“ ist kein gültiges Bild.`);
      images.push({ mimeType: type, data: f.buffer });
    }
    if (!body.text.trim() && !images.length) {
      throw new HttpError(400, 'Bitte füge einen Text ein oder lade einen Screenshot hoch.');
    }

    const result = await analyze({ text: body.text, context: body.context, platform: body.platform, images }, ctx.settings, {
      allowPrivateFetch: ctx.config.fetchAllowPrivate,
    });
    ctx.stats.record(result.verdict, result.category, result.engine.mode === 'ai');
    res.json(result);
  });

  return router;
}

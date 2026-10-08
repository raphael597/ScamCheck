import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: `Ungültige Eingabe${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}` });
  }
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'Ein Bild ist zu groß.',
      LIMIT_FILE_COUNT: 'Zu viele Bilder.',
      LIMIT_UNEXPECTED_FILE: 'Unerwartetes Upload-Feld.',
    };
    return res.status(400).json({ error: messages[err.code] ?? 'Upload fehlgeschlagen.' });
  }
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: (err as Error).message || 'Ungültige Anfrage' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Interner Fehler. Bitte später erneut versuchen.' });
}

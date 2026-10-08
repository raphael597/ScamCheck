import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errors.js';

/**
 * Small in-memory sliding-window limiter, keyed by client IP. Good enough for a
 * single container; put a shared store in front if you scale horizontally.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly limit: () => number,
  ) {
    setInterval(() => this.sweep(), Math.min(windowMs, 10 * 60_000)).unref();
  }

  /** Returns seconds until the next slot frees up, or 0 if the hit was accepted. */
  take(key: string): number {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit()) {
      this.hits.set(key, list);
      return Math.ceil((this.windowMs - (now - list[0]!)) / 1000);
    }
    list.push(now);
    this.hits.set(key, list);
    return 0;
  }

  /** Throws a 429 HttpError (and sets Retry-After) when the client is over the limit. */
  enforce(req: Request, res: Response, message: string) {
    const wait = this.take(req.ip ?? 'unknown');
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      throw new HttpError(429, `${message} Bitte versuche es in ${Math.ceil(wait / 60)} Minute(n) erneut.`);
    }
  }

  middleware(message: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        this.enforce(req, res, message);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  private sweep() {
    const now = Date.now();
    for (const [key, list] of this.hits) {
      const fresh = list.filter((t) => now - t < this.windowMs);
      if (fresh.length) this.hits.set(key, fresh);
      else this.hits.delete(key);
    }
  }
}

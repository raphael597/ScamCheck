import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errors.js';

export const ADMIN_COOKIE = 'sc_admin';
const SESSION_HOURS = 12;

/**
 * Admin authentication with a single shared password.
 * ADMIN_PASSWORD from the environment wins; otherwise a random password is
 * generated on first start and written to <data>/admin-password.txt.
 */
export class AdminAuth {
  private readonly password: string;
  readonly generated: boolean;

  constructor(
    dataDir: string,
    envPassword: string,
    private readonly signingKey: Buffer,
  ) {
    if (envPassword) {
      this.password = envPassword;
      this.generated = false;
      return;
    }
    const file = path.join(dataDir, 'admin-password.txt');
    if (fs.existsSync(file)) {
      this.password = fs.readFileSync(file, 'utf8').trim();
      this.generated = false;
    } else {
      this.password = randomBytes(12).toString('base64url');
      fs.writeFileSync(file, `${this.password}\n`, { mode: 0o600 });
      this.generated = true;
    }
  }

  get passwordFileHint() {
    return 'admin-password.txt im Datenverzeichnis';
  }

  /** Only used once at first start to print the generated password. */
  revealGenerated(): string | null {
    return this.generated ? this.password : null;
  }

  verify(candidate: string): boolean {
    const a = createHmac('sha256', this.signingKey).update(candidate).digest();
    const b = createHmac('sha256', this.signingKey).update(this.password).digest();
    return timingSafeEqual(a, b);
  }

  issue(): { token: string; expires: Date } {
    const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
    const payload = `${expires.getTime()}.${randomBytes(8).toString('hex')}`;
    const sig = createHmac('sha256', this.signingKey).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expires };
  }

  check(token: string | undefined): boolean {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [exp, nonce, sig] = parts as [string, string, string];
    const expected = createHmac('sha256', this.signingKey).update(`${exp}.${nonce}`).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
    return Number(exp) > Date.now();
  }

  middleware() {
    return (req: Request, _res: Response, next: NextFunction) => {
      const header = req.get('authorization');
      const token = (req.cookies as Record<string, string> | undefined)?.[ADMIN_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
      if (!this.check(token)) return next(new HttpError(401, 'Bitte als Admin anmelden.'));
      next();
    };
  }
}

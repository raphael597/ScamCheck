import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Secrets (API keys) are stored AES-256-GCM encrypted. The key comes from
 * SETTINGS_SECRET or, if unset, from a random key file in the data directory.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(dataDir: string, secret: string) {
    if (secret) {
      this.key = createHash('sha256').update(secret).digest();
      return;
    }
    const keyFile = path.join(dataDir, '.secret.key');
    if (fs.existsSync(keyFile)) {
      this.key = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
    } else {
      this.key = randomBytes(32);
      fs.writeFileSync(keyFile, this.key.toString('base64'), { mode: 0o600 });
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
  }

  decrypt(payload: string): string | null {
    try {
      const [version, iv, tag, data] = payload.split(':');
      if (version !== 'v1' || !iv || !tag || !data) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  /** HMAC-like signing key derived from the same secret. */
  get signingKey(): Buffer {
    return createHash('sha256').update(Buffer.concat([this.key, Buffer.from('session')])).digest();
  }
}

export function writeFileAtomic(file: string, content: string, mode = 0o600) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { mode });
  fs.renameSync(tmp, file);
}

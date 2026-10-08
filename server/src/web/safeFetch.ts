import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

/**
 * HTTP client for URLs supplied by visitors. Guards against SSRF:
 * - only http/https on ports 80/443
 * - every DNS answer is checked against private, loopback, link-local and
 *   reserved ranges, and the connection uses exactly the checked address
 *   (no DNS rebinding between check and connect)
 * - redirects are followed manually and each hop is checked again
 * - strict time and size limits, no cookies, no JavaScript
 */

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net4, prefix, 'ipv4');
}
for (const [net6, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(net6, prefix, 'ipv6');
}

/** True for addresses the server must never connect to on behalf of visitors. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1]!, 'ipv4');
    if (/^::ffff:/i.test(address)) return true;
    return blocked.check(address, 'ipv6');
  }
  return true;
}

export class FetchBlockedError extends Error {}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  /** Content types that are read; anything else is rejected without downloading. */
  allowedTypes?: RegExp;
  /** Only for tests: permit loopback/private targets. */
  allowPrivate?: boolean;
}

export interface SafeFetchResult {
  url: string;
  redirects: string[];
  status: number;
  contentType: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ScamCheck/1.0';

function guardedLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err, '', 4);
      if (!addresses.length) return callback(new Error('Domain konnte nicht aufgelöst werden'), '', 4);
      if (!allowPrivate && addresses.some((a) => isBlockedAddress(a.address))) {
        return callback(new FetchBlockedError('Ziel liegt in einem internen Netz und wird nicht geöffnet'), '', 4);
      }
      const list = options.family ? addresses.filter((a) => a.family === options.family) : addresses;
      if (!list.length) return callback(new Error('Keine passende IP-Adresse'), '', 4);
      if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

function checkUrl(url: URL, allowPrivate: boolean) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchBlockedError('Nur http- und https-Links werden geöffnet');
  if (url.username || url.password) throw new FetchBlockedError('Links mit Zugangsdaten werden nicht geöffnet');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!allowPrivate && port !== 80 && port !== 443) throw new FetchBlockedError(`Port ${port} wird nicht geöffnet`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate && net.isIP(host) && isBlockedAddress(host)) throw new FetchBlockedError('Ziel liegt in einem internen Netz und wird nicht geöffnet');
  if (!allowPrivate && /(^|\.)(localhost|local|internal|home|lan)$/i.test(host)) throw new FetchBlockedError('Interne Hostnamen werden nicht geöffnet');
}

function decode(body: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  // SYNC_FLUSH lets us decode a body that was cut off at maxBytes.
  const opts = { maxOutputLength: maxBytes * 4, finishFlush: zlib.constants.Z_SYNC_FLUSH };
  switch ((encoding ?? '').trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return zlib.gunzipSync(body, opts);
    case 'deflate':
      try {
        return zlib.inflateSync(body, opts);
      } catch {
        return zlib.inflateRawSync(body, opts);
      }
    case 'br':
      return zlib.brotliDecompressSync(body, { maxOutputLength: maxBytes * 4, finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH });
    default:
      return body;
  }
}

function requestOnce(url: URL, opts: Required<Omit<SafeFetchOptions, 'timeoutMs'>>, signal: AbortSignal) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer | null }>((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: guardedLookup(opts.allowPrivate),
        signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: opts.accept,
          'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
          'accept-encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, headers: res.headers, body: null });
        }
        const type = String(res.headers['content-type'] ?? '');
        if (status < 400 && !opts.allowedTypes.test(type)) {
          res.destroy();
          return reject(new Error(`Inhaltstyp „${type.split(';')[0] || 'unbekannt'}“ wird nicht ausgewertet`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            // Keep what we have: the start of a page is enough for the analysis.
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('close', () => {
          try {
            resolve({ status, headers: res.headers, body: decode(Buffer.concat(chunks), res.headers['content-encoding'] as string | undefined, opts.maxBytes) });
          } catch {
            resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const opts = {
    maxBytes: options.maxBytes ?? 1_500_000,
    maxRedirects: options.maxRedirects ?? 5,
    accept: options.accept ?? 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    allowedTypes: options.allowedTypes ?? /^(text\/html|application\/xhtml\+xml|text\/plain)/i,
    allowPrivate: options.allowPrivate ?? false,
  };
  const signal = AbortSignal.timeout(options.timeoutMs ?? 8000);
  const redirects: string[] = [];
  let url = new URL(rawUrl);

  for (let hop = 0; ; hop++) {
    checkUrl(url, opts.allowPrivate);
    let res;
    try {
      res = await requestOnce(url, opts, signal);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') throw new Error('Zeitüberschreitung beim Abruf');
      throw err;
    }
    if (res.body === null) {
      if (hop >= opts.maxRedirects) throw new Error('Zu viele Weiterleitungen');
      redirects.push(url.toString());
      url = new URL(String(res.headers.location), url);
      continue;
    }
    return {
      url: url.toString(),
      redirects,
      status: res.status,
      contentType: String(res.headers['content-type'] ?? ''),
      headers: res.headers,
      body: res.body,
    };
  }
}

import { LlmError } from './types.js';

/**
 * Parses JSON from model output that may be wrapped in Markdown fences or
 * surrounded by chatter. Local models in particular don't always follow
 * "JSON only" instructions to the letter.
 */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], extractObject(trimmed)].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    for (const variant of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        return JSON.parse(variant);
      } catch {
        /* try next */
      }
    }
  }
  throw new LlmError('Die KI-Antwort war kein gültiges JSON', undefined, true);
}

/** Returns the first balanced {...} block, respecting strings. */
function extractObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

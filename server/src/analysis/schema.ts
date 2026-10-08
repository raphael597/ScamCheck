import { z } from 'zod';
import { CATEGORIES, VERDICTS, type ModelVerdict, type Verdict } from '../types.js';

const severity = z.enum(['low', 'medium', 'high']).catch('medium');
const str = (max: number) =>
  z
    .unknown()
    .optional()
    .transform((v) => (v == null ? '' : String(v)).trim().slice(0, max));
const strList = (maxItems: number, maxLen: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .map((v) => (v == null ? '' : String(v)).trim().slice(0, maxLen))
        .filter(Boolean)
        .slice(0, maxItems),
    );

/**
 * Lenient validator for model output. Models occasionally drift from the schema
 * (wrong enum casing, numbers as strings, missing arrays), so we coerce instead of failing.
 */
export const modelVerdictSchema = z
  .object({
    riskScore: z.coerce.number().catch(50),
    verdict: z
      .string()
      .transform((v) => v.toLowerCase().trim().replace(/[\s-]+/g, '_'))
      .pipe(z.enum(VERDICTS))
      .optional()
      .catch(undefined),
    confidence: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(['low', 'medium', 'high']))
      .catch('medium'),
    category: z
      .string()
      .transform((v) => v.toLowerCase().trim().replace(/[\s-]+/g, '_'))
      .pipe(z.enum(CATEGORIES))
      .catch('other'),
    headline: str(220),
    summary: str(1500),
    redFlags: z
      .array(
        z.object({
          title: str(120),
          detail: str(500),
          evidence: str(300).optional().default(''),
          severity,
        }),
      )
      .catch([])
      .transform((l) => l.filter((f) => f.title).slice(0, 10)),
    greenFlags: z
      .array(z.object({ title: str(120), detail: str(400) }))
      .catch([])
      .transform((l) => l.filter((f) => f.title).slice(0, 6)),
    recommendations: strList(8, 400),
    ifAlreadyInteracted: strList(8, 400),
    questionsToVerify: strList(6, 300),
    extractedText: str(4000).optional().default(''),
  })
  .transform((v): ModelVerdict => {
    const riskScore = Math.round(Math.min(100, Math.max(0, Number.isFinite(v.riskScore) ? v.riskScore : 50)));
    return { ...v, riskScore, verdict: v.verdict ?? verdictFromScore(riskScore) };
  });

export function verdictFromScore(score: number): Verdict {
  if (score >= 85) return 'scam';
  if (score >= 65) return 'likely_scam';
  if (score >= 40) return 'suspicious';
  if (score >= 20) return 'unclear';
  return 'safe';
}

/** JSON schema for OpenAI structured outputs (strict mode requires every key to be required). */
export const modelVerdictJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'riskScore',
    'verdict',
    'confidence',
    'category',
    'headline',
    'summary',
    'redFlags',
    'greenFlags',
    'recommendations',
    'ifAlreadyInteracted',
    'questionsToVerify',
    'extractedText',
  ],
  properties: {
    riskScore: { type: 'integer', description: 'Betrugsrisiko 0–100' },
    verdict: { type: 'string', enum: [...VERDICTS] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    category: { type: 'string', enum: [...CATEGORIES] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    redFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'evidence', 'severity'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    greenFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail'],
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
    ifAlreadyInteracted: { type: 'array', items: { type: 'string' } },
    questionsToVerify: { type: 'array', items: { type: 'string' } },
    extractedText: { type: 'string' },
  },
} as const;

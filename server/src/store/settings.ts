import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { PROVIDERS, type LlmConfig, type ProviderId } from '../llm/types.js';
import { DEFAULT_FEEDS, type FeedConfig } from '../news/sources.js';
import { SecretBox, writeFileAtomic } from './crypto.js';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  none: '',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-opus-5-5',
  openai_compatible: 'llama3.1',
};

const feedSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  url: z.url({ protocol: /^https?$/ }).max(500),
  lang: z.enum(['de', 'en']),
  kind: z.enum(['consumer', 'tech', 'gov']),
  enabled: z.boolean(),
});

const storedSchema = z.object({
  llm: z
    .object({
      provider: z.enum(PROVIDERS).default('none'),
      apiKeyEnc: z.string().optional(),
      model: z.string().max(120).default(''),
      baseUrl: z.string().max(300).default(''),
      temperature: z.number().min(0).max(2).nullable().default(0.2),
      maxTokens: z.number().int().min(500).max(32000).default(2500),
      vision: z.boolean().default(true),
      effort: z.enum(['low', 'medium', 'high']).default('low'),
      timeoutSeconds: z.number().int().min(10).max(600).default(90),
    })
    .prefault({}),
  prompt: z.object({ systemOverride: z.string().max(40000).nullable().default(null) }).prefault({}),
  news: z
    .object({
      feeds: z.array(feedSchema).max(40).default(DEFAULT_FEEDS),
      refreshMinutes: z.number().int().min(5).max(1440).default(30),
      aiExplain: z.boolean().default(true),
    })
    .prefault({}),
  limits: z
    .object({
      checksPerHour: z.number().int().min(1).max(10000).default(30),
      explainPerHour: z.number().int().min(1).max(10000).default(30),
    })
    .prefault({}),
});

type Stored = z.infer<typeof storedSchema>;

export const settingsUpdateSchema = z.object({
  llm: z
    .object({
      provider: z.enum(PROVIDERS),
      /** undefined = keep, '' = delete, otherwise new key */
      apiKey: z.string().max(500).optional(),
      model: z.string().max(120),
      baseUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(300)]),
      temperature: z.number().min(0).max(2).nullable(),
      maxTokens: z.number().int().min(500).max(32000),
      vision: z.boolean(),
      effort: z.enum(['low', 'medium', 'high']),
      timeoutSeconds: z.number().int().min(10).max(600),
    })
    .partial()
    .optional(),
  prompt: z.object({ systemOverride: z.string().max(40000).nullable() }).optional(),
  news: z
    .object({
      feeds: z.array(feedSchema).max(40),
      refreshMinutes: z.number().int().min(5).max(1440),
      aiExplain: z.boolean(),
    })
    .partial()
    .optional(),
  limits: z
    .object({
      checksPerHour: z.number().int().min(1).max(10000),
      explainPerHour: z.number().int().min(1).max(10000),
    })
    .partial()
    .optional(),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

/** Values set through environment variables win over the admin UI and are shown as locked. */
function envOverrides(env: NodeJS.ProcessEnv) {
  const provider = env.LLM_PROVIDER as ProviderId | undefined;
  const inferredProvider: ProviderId | undefined =
    provider && (PROVIDERS as readonly string[]).includes(provider)
      ? provider
      : env.OPENAI_API_KEY
        ? 'openai'
        : env.ANTHROPIC_API_KEY
          ? 'anthropic'
          : undefined;
  const providerKey =
    inferredProvider === 'anthropic' ? env.ANTHROPIC_API_KEY : inferredProvider === 'openai' ? env.OPENAI_API_KEY : undefined;
  const num = (v?: string) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    provider: inferredProvider,
    apiKey: env.LLM_API_KEY || providerKey || undefined,
    model: env.LLM_MODEL || undefined,
    baseUrl: env.LLM_BASE_URL || undefined,
    temperature: env.LLM_TEMPERATURE === 'none' ? null : num(env.LLM_TEMPERATURE),
    maxTokens: num(env.LLM_MAX_TOKENS),
    vision: env.LLM_VISION ? env.LLM_VISION !== 'false' && env.LLM_VISION !== '0' : undefined,
    effort: (['low', 'medium', 'high'] as const).find((e) => e === env.LLM_EFFORT),
    checksPerHour: num(env.CHECK_RATE_LIMIT_PER_HOUR),
  };
}

export interface PublicSettings {
  llm: {
    provider: ProviderId;
    model: string;
    baseUrl: string;
    temperature: number | null;
    maxTokens: number;
    vision: boolean;
    effort: 'low' | 'medium' | 'high';
    timeoutSeconds: number;
    hasApiKey: boolean;
    apiKeyHint: string;
  };
  prompt: { systemOverride: string | null; defaultPrompt: string };
  news: Stored['news'];
  limits: Stored['limits'];
  locked: string[];
}

export class SettingsStore {
  private stored: Stored;
  private readonly file: string;
  private readonly box: SecretBox;
  private readonly env: ReturnType<typeof envOverrides>;
  private listeners: (() => void)[] = [];

  constructor(dataDir: string, secret: string, env: NodeJS.ProcessEnv = process.env) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'settings.json');
    this.box = new SecretBox(dataDir, secret);
    this.env = envOverrides(env);
    this.stored = this.load();
  }

  get secretBox() {
    return this.box;
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  private load(): Stored {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = storedSchema.safeParse(JSON.parse(fs.readFileSync(this.file, 'utf8')));
        if (parsed.success) return parsed.data;
        console.warn('[settings] settings.json ungültig – verwende Standardwerte:', parsed.error.issues[0]?.message);
      }
    } catch (err) {
      console.warn('[settings] Konnte settings.json nicht lesen:', (err as Error).message);
    }
    return storedSchema.parse({});
  }

  private save() {
    writeFileAtomic(this.file, JSON.stringify(this.stored, null, 2));
    for (const fn of this.listeners) fn();
  }

  get lockedFields(): string[] {
    const e = this.env;
    return [
      e.provider && 'llm.provider',
      e.apiKey && 'llm.apiKey',
      e.model && 'llm.model',
      e.baseUrl && 'llm.baseUrl',
      e.temperature !== undefined && 'llm.temperature',
      e.maxTokens !== undefined && 'llm.maxTokens',
      e.vision !== undefined && 'llm.vision',
      e.effort && 'llm.effort',
      e.checksPerHour !== undefined && 'limits.checksPerHour',
    ].filter((v): v is string => Boolean(v));
  }

  private get apiKey(): string {
    if (this.env.apiKey) return this.env.apiKey;
    return this.stored.llm.apiKeyEnc ? (this.box.decrypt(this.stored.llm.apiKeyEnc) ?? '') : '';
  }

  /** Effective LLM configuration (env > stored > defaults). */
  llmConfig(): LlmConfig & { effort: 'low' | 'medium' | 'high' } {
    const s = this.stored.llm;
    const e = this.env;
    const provider = e.provider ?? s.provider;
    return {
      provider,
      apiKey: this.apiKey,
      model: e.model ?? (s.model || DEFAULT_MODELS[provider]),
      baseUrl: e.baseUrl ?? s.baseUrl,
      temperature: e.temperature !== undefined ? e.temperature : s.temperature,
      maxTokens: e.maxTokens ?? s.maxTokens,
      vision: e.vision ?? s.vision,
      effort: e.effort ?? s.effort,
      timeoutMs: s.timeoutSeconds * 1000,
    };
  }

  /** True when an AI provider is usable (local OpenAI-compatible servers may not need a key). */
  aiReady(): boolean {
    const c = this.llmConfig();
    if (c.provider === 'none' || !c.model) return false;
    if (c.provider === 'openai_compatible') return Boolean(c.baseUrl);
    return Boolean(c.apiKey);
  }

  get systemOverride() {
    return this.stored.prompt.systemOverride;
  }

  get news() {
    return this.stored.news;
  }

  get limits() {
    return { ...this.stored.limits, checksPerHour: this.env.checksPerHour ?? this.stored.limits.checksPerHour };
  }

  feeds(): FeedConfig[] {
    return this.stored.news.feeds;
  }

  toPublic(defaultPrompt: string): PublicSettings {
    const c = this.llmConfig();
    const key = this.apiKey;
    return {
      llm: {
        provider: c.provider,
        model: c.model,
        baseUrl: c.baseUrl,
        temperature: c.temperature,
        maxTokens: c.maxTokens,
        vision: c.vision,
        effort: c.effort,
        timeoutSeconds: this.stored.llm.timeoutSeconds,
        hasApiKey: Boolean(key),
        apiKeyHint: key ? `••••${key.slice(-4)}` : '',
      },
      prompt: { systemOverride: this.stored.prompt.systemOverride, defaultPrompt },
      news: this.stored.news,
      limits: this.limits,
      locked: this.lockedFields,
    };
  }

  update(patch: SettingsUpdate) {
    const next = structuredClone(this.stored);
    if (patch.llm) {
      const { apiKey, ...rest } = patch.llm;
      Object.assign(next.llm, rest);
      if (apiKey !== undefined) {
        next.llm.apiKeyEnc = apiKey ? this.box.encrypt(apiKey.trim()) : undefined;
      }
      if (rest.provider && rest.provider !== this.stored.llm.provider && rest.model === undefined) {
        next.llm.model = DEFAULT_MODELS[rest.provider];
      }
    }
    if (patch.prompt) next.prompt.systemOverride = patch.prompt.systemOverride?.trim() ? patch.prompt.systemOverride : null;
    if (patch.news) Object.assign(next.news, patch.news);
    if (patch.limits) Object.assign(next.limits, patch.limits);
    this.stored = storedSchema.parse(next);
    this.save();
  }
}

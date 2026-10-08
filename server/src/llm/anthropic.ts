import Anthropic from '@anthropic-ai/sdk';
import { parseJsonLoose } from './parse.js';
import { LlmError, type JsonRequest, type LlmClient, type LlmConfig } from './types.js';

type Effort = 'low' | 'medium' | 'high';
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const supportsFallback = (model: string) => /^claude-(?:opus-5|fable-5|sonnet-5-5|mythos-5)/.test(model);

export class AnthropicClient implements LlmClient {
  readonly provider = 'anthropic' as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(
    private readonly config: LlmConfig,
    private readonly effort: Effort = 'low',
  ) {
    this.model = config.model;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
      timeout: config.timeoutMs,
      maxRetries: 1,
    });
  }

  async completeJson(req: JsonRequest): Promise<unknown> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (this.config.vision) {
      for (const img of req.images ?? []) {
        content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType as ImageMediaType, data: img.base64 } });
      }
    }
    content.push({ type: 'text', text: req.user });

    const officialApi = !this.config.baseUrl;
    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: Math.max(req.maxTokens ?? this.config.maxTokens, 16000),
      system: req.system,
      messages: [{ role: 'user', content }],
      output_config: {
        effort: this.effort,
        ...(req.schema ? { format: { type: 'json_schema', schema: req.schema.schema as Record<string, unknown> } } : {}),
      },
    };
    if (officialApi && supportsFallback(this.model)) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create(params);
    } catch (err) {
      // Older models (or proxies) may not know effort/structured outputs/fallbacks: retry with the plain request.
      if (err instanceof Anthropic.BadRequestError) {
        const { output_config: _oc, betas: _b, fallbacks: _f, ...plain } = params;
        try {
          response = await this.client.beta.messages.create(plain);
        } catch (retryErr) {
          throw toLlmError(retryErr);
        }
      } else {
        throw toLlmError(err);
      }
    }

    if (response.stop_reason === 'refusal') {
      throw new LlmError('Das Modell hat die Analyse aus Sicherheitsgründen abgelehnt.');
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text) {
      throw new LlmError(response.stop_reason === 'max_tokens' ? 'Antwort wurde abgeschnitten (Token-Limit zu niedrig)' : 'Leere Antwort vom Modell', undefined, true);
    }
    return parseJsonLoose(text);
  }

  async listModels(): Promise<string[]> {
    try {
      const ids: string[] = [];
      for await (const model of this.client.models.list({ limit: 100 })) ids.push(model.id);
      return ids.sort();
    } catch (err) {
      throw toLlmError(err);
    }
  }
}

function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new LlmError('KI-Anbieter antwortete mit 401 (API-Key ungültig?)', 401);
  if (err instanceof Anthropic.NotFoundError) return new LlmError('KI-Anbieter antwortete mit 404 (Modellname prüfen)', 404);
  if (err instanceof Anthropic.RateLimitError) return new LlmError('KI-Anbieter antwortete mit 429 (Rate-Limit oder Guthaben aufgebraucht)', 429, true);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new LlmError('Verbindung zum KI-Anbieter: Zeitüberschreitung', undefined, true);
  if (err instanceof Anthropic.APIConnectionError) return new LlmError(`Verbindung zum KI-Anbieter fehlgeschlagen: ${err.message}`, undefined, true);
  if (err instanceof Anthropic.APIError) return new LlmError(`KI-Anbieter antwortete mit ${err.status}: ${err.message}`, err.status, (err.status ?? 0) >= 500);
  return new LlmError(`Unbekannter Fehler beim KI-Anbieter: ${(err as Error).message}`);
}

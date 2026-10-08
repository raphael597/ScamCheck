import { LlmError, type JsonRequest, type LlmClient, type LlmConfig } from './types.js';
import { parseJsonLoose } from './parse.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Reasoning models reject custom temperature and use a reasoning budget instead. */
const isReasoningModel = (model: string) => /^(?:o\d|gpt-5)/i.test(model);

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } };

/**
 * Client for the OpenAI Chat Completions API and compatible servers
 * (Ollama, LM Studio, OpenRouter, Mistral, Groq, Gemini's OpenAI endpoint, …).
 */
export class OpenAiClient implements LlmClient {
  readonly provider;
  readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: LlmConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private get isOfficial() {
    return this.config.provider === 'openai';
  }

  async completeJson(req: JsonRequest): Promise<unknown> {
    const userContent: ContentPart[] = [{ type: 'text', text: req.user }];
    if (this.config.vision) {
      for (const img of req.images ?? []) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'auto' } });
      }
    }

    const reasoning = isReasoningModel(this.model);
    const maxTokens = req.maxTokens ?? this.config.maxTokens;
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: userContent.length === 1 ? req.user : userContent },
      ],
    };
    if (this.isOfficial) {
      body.max_completion_tokens = reasoning ? Math.max(maxTokens, 6000) : maxTokens;
      if (reasoning) body.reasoning_effort = 'low';
    } else {
      body.max_tokens = maxTokens;
    }
    if (this.config.temperature != null && !reasoning) body.temperature = this.config.temperature;

    if (req.schema && this.isOfficial) {
      body.response_format = { type: 'json_schema', json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema } };
    } else {
      body.response_format = { type: 'json_object' };
    }

    let res = await this.post(body);
    // Some compatible servers don't understand response_format or reasoning_effort – retry without.
    if (res.status === 400 || res.status === 422) {
      const text = await res.text();
      if (/response_format|json_schema|json_object|reasoning_effort|temperature/i.test(text)) {
        delete body.response_format;
        delete body.reasoning_effort;
        delete body.temperature;
        res = await this.post(body);
      } else {
        throw this.errorFrom(res.status, text);
      }
    }
    if (!res.ok) throw this.errorFrom(res.status, await res.text());

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new LlmError(`Das Modell hat die Anfrage abgelehnt: ${choice.message.refusal}`);
    const content = choice?.message?.content;
    if (!content) {
      throw new LlmError(
        choice?.finish_reason === 'length' ? 'Antwort wurde abgeschnitten (Token-Limit zu niedrig)' : 'Leere Antwort vom Modell',
        undefined,
        true,
      );
    }
    return parseJsonLoose(content);
  }

  private async post(body: Record<string, unknown>): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
          ...(this.baseUrl.includes('openrouter.ai') ? { 'x-title': 'ScamCheck' } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      const reason = (err as Error).name === 'TimeoutError' ? 'Zeitüberschreitung' : (err as Error).message;
      throw new LlmError(`Verbindung zum KI-Anbieter fehlgeschlagen: ${reason}`, undefined, true);
    }
  }

  private errorFrom(status: number, text: string): LlmError {
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string };
      message = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? message);
    } catch {
      /* not JSON */
    }
    const hint =
      status === 401 ? ' (API-Key ungültig?)' : status === 404 ? ' (Modellname oder Basis-URL prüfen)' : status === 429 ? ' (Rate-Limit oder Guthaben aufgebraucht)' : '';
    return new LlmError(`KI-Anbieter antwortete mit ${status}${hint}: ${message}`, status, status === 429 || status >= 500);
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {},
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw this.errorFrom(res.status, await res.text());
    const data = (await res.json()) as { data?: { id: string }[]; models?: { name: string }[] };
    return (data.data?.map((m) => m.id) ?? data.models?.map((m) => m.name) ?? []).sort();
  }
}

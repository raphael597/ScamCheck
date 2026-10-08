export const PROVIDERS = ['none', 'openai', 'anthropic', 'openai_compatible'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export interface LlmConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number | null;
  maxTokens: number;
  vision: boolean;
  timeoutMs: number;
}

export interface LlmImage {
  mimeType: string;
  base64: string;
}

export interface JsonRequest {
  system: string;
  user: string;
  images?: LlmImage[];
  /** JSON schema for providers that support constrained decoding. */
  schema?: { name: string; schema: object };
  maxTokens?: number;
}

export interface LlmClient {
  readonly provider: ProviderId;
  readonly model: string;
  completeJson(req: JsonRequest): Promise<unknown>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

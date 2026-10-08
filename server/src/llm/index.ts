import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { AnthropicClient } from './anthropic.js';
import { OpenAiClient } from './openai.js';
import type { LlmClient, LlmConfig } from './types.js';

export * from './types.js';

export function createLlmClient(cfg: LlmConfig & { effort?: 'low' | 'medium' | 'high' }): (LlmClient & { listModels(): Promise<string[]> }) | null {
  switch (cfg.provider) {
    case 'openai':
    case 'openai_compatible':
      return new OpenAiClient(cfg);
    case 'anthropic':
      return new AnthropicClient(cfg, cfg.effort);
    default:
      return null;
  }
}

const promptCache = new Map<string, string>();

/** Loads a prompt file from server/prompts (cached; files are part of the image). */
export function loadPrompt(name: string): string {
  let prompt = promptCache.get(name);
  if (prompt === undefined) {
    prompt = fs.readFileSync(path.join(config.promptsDir, name), 'utf8').trim();
    promptCache.set(name, prompt);
  }
  return prompt;
}

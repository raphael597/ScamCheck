import type { AdminSettings, AdminStats, AnalysisResult, DemoCase, Meta, NewsResponse, Platform, SourceStatus } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('Keine Verbindung zum Server. Bist du online?', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Fehler ${res.status}`, res.status);
  return data as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface CheckInput {
  text: string;
  context: string;
  platform: Platform;
  images: File[];
}

export const api = {
  meta: () => request<Meta>('/meta'),

  check(input: CheckInput) {
    const form = new FormData();
    form.set('text', input.text);
    form.set('context', input.context);
    form.set('platform', input.platform);
    for (const img of input.images) form.append('images', img);
    return request<AnalysisResult>('/check', { method: 'POST', body: form });
  },

  demoCases: () => request<{ aiReady: boolean; cases: DemoCase[] }>('/demo'),
  runDemo: (id: string, mode: 'auto' | 'sample' | 'live') => request<AnalysisResult>(`/demo/${id}/run`, json('POST', { mode })),

  news(params: Record<string, string | number | boolean | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) qs.set(k, String(v));
    return request<NewsResponse>(`/news?${qs}`);
  },
  explainNews: (id: string) => request<{ summary: string; affected: string; actions: string[] }>(`/news/${id}/explain`, { method: 'POST' }),

  admin: {
    login: (password: string) => request<{ ok: true }>('/admin/login', json('POST', { password })),
    logout: () => request<{ ok: true }>('/admin/logout', json('POST')),
    session: () => request<{ ok: true }>('/admin/session'),
    settings: () => request<AdminSettings>('/admin/settings'),
    save: (patch: unknown) => request<AdminSettings>('/admin/settings', json('PUT', patch)),
    test: (llm: unknown) => request<{ ok: boolean; provider: string; model: string; latencyMs: number; message: string }>('/admin/llm/test', json('POST', { llm })),
    models: (llm: unknown) => request<{ models: string[] }>('/admin/llm/models', json('POST', { llm })),
    stats: () => request<AdminStats>('/admin/stats'),
    refreshNews: () => request<{ sources: SourceStatus[] }>('/admin/news/refresh', json('POST')),
    sources: () => request<{ sources: SourceStatus[] }>('/admin/news/sources'),
  },
};

// Mirrors server/src/types.ts – keep in sync.
export type Verdict = 'safe' | 'unclear' | 'suspicious' | 'likely_scam' | 'scam';
export type Severity = 'low' | 'medium' | 'high';
export type Platform =
  | 'unknown'
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'marketplace'
  | 'social'
  | 'shop'
  | 'job'
  | 'rental'
  | 'dating'
  | 'phone'
  | 'other';

export interface RedFlag {
  title: string;
  detail: string;
  evidence: string;
  severity: Severity;
}

export interface HeuristicSignal {
  id: string;
  group: string;
  label: string;
  weight: number;
  matches: string[];
  categories: string[];
}

export interface UrlFinding {
  url: string;
  host: string;
  registrableDomain: string | null;
  risk: number;
  issues: string[];
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  riskScore: number;
  verdict: Verdict;
  verdictLabel: string;
  confidence: 'low' | 'medium' | 'high';
  category: string;
  categoryLabel: string;
  headline: string;
  summary: string;
  redFlags: RedFlag[];
  greenFlags: { title: string; detail: string }[];
  recommendations: string[];
  ifAlreadyInteracted: string[];
  questionsToVerify: string[];
  extractedText: string;
  signals: HeuristicSignal[];
  urls: UrlFinding[];
  heuristicScore: number;
  engine: { mode: 'ai' | 'heuristic' | 'demo'; provider?: string; model?: string; durationMs: number; fallbackReason?: string };
}

export interface Meta {
  version: string;
  ai: { ready: boolean; provider: string; model: string | null; vision: boolean };
  limits: { maxImages: number; maxImageMB: number; maxTextChars: number; checksPerHour: number };
  news: { aiExplain: boolean };
  stats: { totalChecks: number; warned: number; aiChecks: number; topCategories: { category: string; count: number }[] };
}

export interface DemoCase {
  id: string;
  title: string;
  teaser: string;
  platform: Platform;
  channel: {
    kind: 'sms' | 'email' | 'whatsapp' | 'marketplace' | 'social' | 'shop' | 'job' | 'rental';
    sender: string;
    subject?: string;
    meta?: string;
    price?: string;
  };
  text: string;
  context: string;
  expectedVerdict: Verdict;
}

export type Topic = 'scam' | 'phishing' | 'malware' | 'breach' | 'vulnerability' | 'privacy' | 'ai' | 'mobile';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  source: { id: string; name: string; lang: 'de' | 'en'; kind: 'consumer' | 'tech' | 'gov' };
  topics: Topic[];
  isWarning: boolean;
  isSample?: boolean;
  hasImage: boolean;
}

export interface SourceStatus {
  id: string;
  name: string;
  lang: 'de' | 'en';
  kind: 'consumer' | 'tech' | 'gov';
  enabled: boolean;
  ok: boolean | null;
  count: number;
  lastFetched: string | null;
  lastError: string | null;
}

export interface NewsResponse {
  items: NewsItem[];
  total: number;
  isSample: boolean;
  updatedAt: string | null;
  sources: SourceStatus[];
}

export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  lang: 'de' | 'en';
  kind: 'consumer' | 'tech' | 'gov';
  enabled: boolean;
}

export type ProviderId = 'none' | 'openai' | 'anthropic' | 'openai_compatible';

export interface AdminSettings {
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
  news: { feeds: FeedConfig[]; refreshMinutes: number; aiExplain: boolean };
  limits: { checksPerHour: number; explainPerHour: number };
  locked: string[];
}

export interface AdminStats {
  since: string;
  totalChecks: number;
  aiChecks: number;
  warned: number;
  byVerdict: Partial<Record<Verdict, number>>;
  topCategories: { category: string; count: number }[];
}

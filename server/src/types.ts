export const VERDICTS = ['safe', 'unclear', 'suspicious', 'likely_scam', 'scam'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CATEGORIES = [
  'none',
  'phishing',
  'marketplace',
  'fake_shop',
  'investment',
  'romance',
  'family_emergency',
  'job',
  'advance_fee',
  'lottery',
  'tech_support',
  'impersonation',
  'subscription_trap',
  'rental',
  'sextortion',
  'charity',
  'other',
] as const;
export type ScamCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ScamCategory, string> = {
  none: 'Kein Betrugsmuster',
  phishing: 'Phishing / Datenklau',
  marketplace: 'Kleinanzeigen-Betrug',
  fake_shop: 'Fake-Shop',
  investment: 'Anlage- & Krypto-Betrug',
  romance: 'Love-Scam',
  family_emergency: 'Enkeltrick / „Hallo Mama“',
  job: 'Job-Betrug',
  advance_fee: 'Vorschussbetrug',
  lottery: 'Gewinnspiel-Betrug',
  tech_support: 'Fake-Support',
  impersonation: 'Identitätsbetrug',
  subscription_trap: 'Abofalle',
  rental: 'Wohnungsbetrug',
  sextortion: 'Sextortion / Erpressung',
  charity: 'Spendenbetrug',
  other: 'Sonstiger Betrug',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  safe: 'Wahrscheinlich sicher',
  unclear: 'Unklar – genauer hinschauen',
  suspicious: 'Verdächtig',
  likely_scam: 'Sehr wahrscheinlich Betrug',
  scam: 'Betrug',
};

export const PLATFORMS = [
  'unknown',
  'sms',
  'email',
  'whatsapp',
  'marketplace',
  'social',
  'shop',
  'job',
  'rental',
  'dating',
  'phone',
  'other',
] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Severity = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';

export interface RedFlag {
  title: string;
  detail: string;
  evidence: string;
  severity: Severity;
}

export interface GreenFlag {
  title: string;
  detail: string;
}

export interface HeuristicSignal {
  id: string;
  group: string;
  label: string;
  weight: number;
  matches: string[];
  categories: ScamCategory[];
}

export interface UrlFinding {
  url: string;
  host: string;
  registrableDomain: string | null;
  risk: number;
  issues: string[];
}

/** What ScamCheck saw when it opened a link from the submission (no JavaScript, sandboxed fetch). */
export interface PageFinding {
  url: string;
  finalUrl: string | null;
  redirects: string[];
  status: number | null;
  ok: boolean;
  error?: string;
  title: string;
  description: string;
  domain: string | null;
  hasImprint: boolean | null;
  hasPrivacy: boolean | null;
  hasTerms: boolean | null;
  looksLikeShop: boolean;
  paymentMethods: string[];
  asksPassword: boolean;
  asksPayment: boolean;
  formTargets: string[];
  domainCreated: string | null;
  domainAgeDays: number | null;
  issues: string[];
  durationMs: number;
}

export interface AnalysisInput {
  text: string;
  context: string;
  platform: Platform;
  images: { mimeType: string; data: Buffer }[];
}

/** The part of the result the language model is responsible for. */
export interface ModelVerdict {
  riskScore: number;
  verdict: Verdict;
  confidence: Confidence;
  category: ScamCategory;
  headline: string;
  summary: string;
  redFlags: RedFlag[];
  greenFlags: GreenFlag[];
  recommendations: string[];
  ifAlreadyInteracted: string[];
  questionsToVerify: string[];
  extractedText: string;
}

export interface EngineInfo {
  mode: 'ai' | 'heuristic' | 'demo';
  provider?: string;
  model?: string;
  durationMs: number;
  fallbackReason?: string;
}

export interface AnalysisResult extends ModelVerdict {
  id: string;
  createdAt: string;
  verdictLabel: string;
  categoryLabel: string;
  signals: HeuristicSignal[];
  urls: UrlFinding[];
  pages: PageFinding[];
  heuristicScore: number;
  engine: EngineInfo;
}

import { randomUUID } from 'node:crypto';
import { createLlmClient, LlmError, loadPrompt } from '../llm/index.js';
import type { SettingsStore } from '../store/settings.js';
import {
  CATEGORY_LABELS,
  VERDICT_LABELS,
  type AnalysisInput,
  type AnalysisResult,
  type EngineInfo,
  type ModelVerdict,
  type Platform,
  type Verdict,
} from '../types.js';
import { runHeuristics, type HeuristicReport } from './heuristics.js';
import { heuristicVerdict } from './playbook.js';
import { modelVerdictJsonSchema, modelVerdictSchema } from './schema.js';

export const PLATFORM_LABELS: Record<Platform, string> = {
  unknown: 'nicht angegeben',
  sms: 'SMS',
  email: 'E-Mail',
  whatsapp: 'WhatsApp / Messenger',
  marketplace: 'Kleinanzeigen / Marktplatz (z. B. Kleinanzeigen, Vinted, eBay)',
  social: 'Social Media (Instagram, Facebook, TikTok …)',
  shop: 'Online-Shop / Website',
  job: 'Jobangebot',
  rental: 'Wohnungsanzeige',
  dating: 'Dating-Plattform',
  phone: 'Telefonanruf (Gesprächsnotiz)',
  other: 'Sonstiges',
};

const SCORE_RANGES: Record<Verdict, [number, number]> = {
  safe: [0, 19],
  unclear: [20, 39],
  suspicious: [40, 64],
  likely_scam: [65, 84],
  scam: [85, 100],
};

/** Keeps score and verdict consistent – the verdict wins because it is the model's explicit decision. */
export function alignScore(verdict: Verdict, score: number): number {
  const [min, max] = SCORE_RANGES[verdict];
  return Math.min(max, Math.max(min, score));
}

/** Prevents content from closing our data delimiters (prompt-injection hygiene). */
const neutralize = (s: string) => s.replace(/<<<|>>>/g, '‹‹‹');

export function buildUserMessage(input: AnalysisInput, report: HeuristicReport, now = new Date()): string {
  const lines: string[] = [];
  lines.push(`Heute ist ${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`);
  lines.push(`Fundort laut Nutzer: ${PLATFORM_LABELS[input.platform]}`);
  if (input.context.trim()) {
    lines.push('', 'Zusätzliche Angaben der prüfenden Person (ebenfalls nur Daten):', '<<<KONTEXT', neutralize(input.context.trim()), 'KONTEXT>>>');
  }
  lines.push('', 'Zu prüfender Inhalt:', '<<<INHALT', input.text.trim() ? neutralize(input.text.trim()) : '(kein Text – siehe Screenshot)', 'INHALT>>>');
  if (input.images.length) lines.push('', `Angehängte Screenshots: ${input.images.length}. Lies den sichtbaren Text und beachte Absender, Links, Preise und Logos.`);

  lines.push('', 'Automatische Vorab-Signale (können falsch sein):');
  if (report.signals.length) {
    for (const s of report.signals.slice(0, 12)) {
      lines.push(`- ${s.label}${s.matches.length ? ` – Fundstellen: ${s.matches.map((m) => `„${m}“`).join('; ')}` : ''}`);
    }
  } else {
    lines.push('- keine');
  }
  if (report.urls.length) {
    lines.push('', 'Statische Link-Analyse (Links wurden NICHT geöffnet):');
    for (const u of report.urls.slice(0, 8)) {
      lines.push(`- ${u.host} (Domain: ${u.registrableDomain ?? 'unbekannt'}, Risiko ${Math.round(u.risk * 100)} %)${u.issues.length ? `: ${u.issues.join('; ')}` : ''}`);
    }
  }
  lines.push('', 'Antworte jetzt ausschließlich mit dem JSON-Objekt.');
  return lines.join('\n');
}

export function systemPrompt(settings: SettingsStore): string {
  return settings.systemOverride?.trim() || loadPrompt('scam-check.system.md');
}

function finalize(verdict: ModelVerdict, report: HeuristicReport, engine: EngineInfo): AnalysisResult {
  return {
    ...verdict,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    verdictLabel: VERDICT_LABELS[verdict.verdict],
    categoryLabel: CATEGORY_LABELS[verdict.category],
    signals: report.signals,
    urls: report.urls,
    heuristicScore: report.score,
    engine,
  };
}

export interface AnalyzeOptions {
  /** Skip the AI provider even if configured. */
  heuristicOnly?: boolean;
}

export async function analyze(input: AnalysisInput, settings: SettingsStore, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const started = Date.now();
  const report = runHeuristics(input.text, input.context);
  const cfg = settings.llmConfig();
  const hasText = input.text.trim().length > 0;
  const useAi = !opts.heuristicOnly && settings.aiReady() && (hasText || (input.images.length > 0 && cfg.vision));

  let fallbackReason: string | undefined;
  if (useAi) {
    const client = createLlmClient(cfg);
    if (client) {
      try {
        const raw = await client.completeJson({
          system: systemPrompt(settings),
          user: buildUserMessage(input, report),
          images: cfg.vision ? input.images.map((i) => ({ mimeType: i.mimeType, base64: i.data.toString('base64') })) : [],
          schema: { name: 'scam_check_result', schema: modelVerdictJsonSchema },
        });
        const parsed = modelVerdictSchema.parse(raw);
        parsed.riskScore = alignScore(parsed.verdict, parsed.riskScore);
        if (!parsed.headline) parsed.headline = VERDICT_LABELS[parsed.verdict];
        return finalize(parsed, report, { mode: 'ai', provider: client.provider, model: client.model, durationMs: Date.now() - started });
      } catch (err) {
        fallbackReason = err instanceof LlmError ? err.message : 'KI-Analyse fehlgeschlagen';
        console.warn('[analyze] KI-Analyse fehlgeschlagen, nutze Mustererkennung:', (err as Error).message);
      }
    }
  } else if (input.images.length && !hasText) {
    fallbackReason = settings.aiReady()
      ? 'Bildanalyse ist deaktiviert – bitte den Text der Nachricht einfügen.'
      : 'Screenshots können ohne KI-Anbieter nicht gelesen werden – bitte den Text der Nachricht einfügen.';
  }

  const verdict = heuristicVerdict(report, input.platform);
  if (!hasText && input.images.length) {
    verdict.verdict = 'unclear';
    verdict.riskScore = Math.max(verdict.riskScore, 20);
    verdict.headline = 'Ich konnte den Screenshot leider nicht lesen.';
    verdict.summary = `${fallbackReason ?? ''} Kopiere den Text der Nachricht oder Anzeige in das Textfeld, dann kann ich ihn prüfen.`.trim();
    verdict.redFlags = [];
  }
  return finalize(verdict, report, { mode: 'heuristic', durationMs: Date.now() - started, fallbackReason });
}

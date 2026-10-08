import { Check, ChevronDown, CircleAlert, CircleCheck, Copy, Link2, ListChecks, Quote, RotateCcw, Share2, ShieldAlert, Siren } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisResult } from '../lib/types';
import { VERDICT_STYLE } from '../lib/verdict';
import { Mascot } from './Mascot';
import { RiskGauge } from './RiskGauge';
import './result.css';

const CONFIDENCE: Record<AnalysisResult['confidence'], string> = { low: 'niedrig', medium: 'mittel', high: 'hoch' };
const SEVERITY: Record<string, string> = { high: 'Starkes Warnsignal', medium: 'Warnsignal', low: 'Hinweis' };

function engineLabel(r: AnalysisResult): string {
  const secs = (r.engine.durationMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (r.engine.mode === 'ai') return `KI-Analyse (${r.engine.model}) + Mustererkennung · ${secs} s`;
  if (r.engine.mode === 'demo') return 'Demo: vorberechnete Beispiel-Auswertung + echte Mustererkennung';
  return 'Automatische Mustererkennung (ohne KI)';
}

function summaryText(r: AnalysisResult): string {
  return [
    `ScamCheck-Ergebnis: ${r.verdictLabel} (Risiko ${r.riskScore}/100)`,
    r.headline,
    '',
    r.summary,
    '',
    ...(r.redFlags.length ? ['Warnsignale:', ...r.redFlags.map((f) => `• ${f.title}`), ''] : []),
    'Empfehlung:',
    ...r.recommendations.map((s, i) => `${i + 1}. ${s}`),
  ].join('\n');
}

interface ResultViewProps {
  result: AnalysisResult;
  onReset?: () => void;
  compact?: boolean;
}

export function ResultView({ result: r, onReset, compact = false }: ResultViewProps) {
  const style = VERDICT_STYLE[r.verdict];
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showSignals, setShowSignals] = useState(false);
  const severe = r.verdict === 'scam' || r.verdict === 'likely_scam';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(r));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'ScamCheck-Ergebnis', text: summaryText(r) });
    } catch {
      /* cancelled */
    }
  };
  const toggleStep = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <article className={`result verdict-${r.verdict} ${compact ? 'is-compact' : ''}`} aria-live="polite">
      <header className="visor result-hero">
        <div className="result-hero-main">
          <div className="result-verdict">
            <span className="result-pill">
              {severe ? <ShieldAlert size={16} aria-hidden="true" /> : r.verdict === 'safe' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
              {r.verdictLabel}
            </span>
            {r.category !== 'none' && <span className="result-cat">{r.categoryLabel}</span>}
          </div>
          <h2 className="result-headline">{r.headline}</h2>
          <p className="result-summary">{r.summary}</p>
          <p className="result-meta">
            Sicherheit der Einschätzung: <strong>{CONFIDENCE[r.confidence]}</strong>
          </p>
        </div>
        <div className="result-hero-side">
          <RiskGauge score={r.riskScore} verdict={r.verdict} />
          {!compact && (
            <Mascot
              key={r.id}
              pose={style.pose}
              motion={style.motion}
              size={120}
              say={style.say}
              bubbleSide="left"
              shadow={false}
              className="result-mascot"
            />
          )}
        </div>
      </header>

      {r.engine.fallbackReason && (
        <div className="notice notice-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            <strong>Hinweis:</strong> {r.engine.fallbackReason} Das Ergebnis basiert deshalb auf der automatischen Mustererkennung.
          </span>
        </div>
      )}

      <div className="result-grid">
        <div className="result-col">
          {r.redFlags.length > 0 && (
            <section className="card card-pad result-section">
              <h3>
                <CircleAlert size={20} aria-hidden="true" /> Warnsignale <span className="count">{r.redFlags.length}</span>
              </h3>
              <ul className="flag-list">
                {r.redFlags.map((f, i) => (
                  <li key={i} className={`flag sev-${f.severity}`} style={{ '--i': i } as React.CSSProperties}>
                    <div className="flag-head">
                      <strong>{f.title}</strong>
                      <span className="flag-sev">{SEVERITY[f.severity]}</span>
                    </div>
                    <p>{f.detail}</p>
                    {f.evidence && (
                      <blockquote className="evidence">
                        <Quote size={14} aria-hidden="true" />
                        <span>{f.evidence}</span>
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.greenFlags.length > 0 && (
            <section className="card card-pad result-section">
              <h3>
                <CircleCheck size={20} aria-hidden="true" /> Was dafür spricht
              </h3>
              <ul className="green-list">
                {r.greenFlags.map((f, i) => (
                  <li key={i}>
                    <strong>{f.title}</strong>
                    <span>{f.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.urls.length > 0 && (
            <section className="card card-pad result-section">
              <h3>
                <Link2 size={20} aria-hidden="true" /> Link-Analyse
              </h3>
              <p className="muted small">Links werden nur untersucht, nie geöffnet.</p>
              <ul className="url-list">
                {r.urls.map((u) => (
                  <li key={u.url}>
                    <div className="url-head">
                      <code>{u.host}</code>
                      <span className="url-risk" style={{ '--r': u.risk } as React.CSSProperties}>
                        <span />
                      </span>
                    </div>
                    {u.issues.length > 0 && (
                      <ul className="url-issues">
                        {u.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="result-col">
          <section className="card card-pad result-section result-actions">
            <h3>
              <ListChecks size={20} aria-hidden="true" /> Das solltest du jetzt tun
            </h3>
            <ol className="step-list">
              {r.recommendations.map((step, i) => (
                <li key={i}>
                  <button type="button" className={`step ${done.has(i) ? 'is-done' : ''}`} onClick={() => toggleStep(i)} aria-pressed={done.has(i)}>
                    <span className="step-check">{done.has(i) ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                    <span>{step}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {r.ifAlreadyInteracted.length > 0 && (
            <details className="card card-pad result-section emergency" open={severe}>
              <summary>
                <Siren size={20} aria-hidden="true" />
                <span>Schon geklickt, bezahlt oder Daten eingegeben?</span>
                <ChevronDown size={18} className="chev" aria-hidden="true" />
              </summary>
              <ul>
                {r.ifAlreadyInteracted.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <Link to="/hilfe" className="btn btn-sm btn-danger">
                Zur Schritt-für-Schritt-Hilfe
              </Link>
            </details>
          )}

          {r.questionsToVerify.length > 0 && (
            <section className="card card-pad result-section">
              <h3>Frag dich selbst</h3>
              <ul className="question-list">
                {r.questionsToVerify.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          )}

          {r.extractedText && (
            <details className="card card-pad result-section">
              <summary>
                <span>Erkannter Text im Screenshot</span>
                <ChevronDown size={18} className="chev" aria-hidden="true" />
              </summary>
              <p className="extracted">{r.extractedText}</p>
            </details>
          )}
        </div>
      </div>

      {r.signals.length > 0 && (
        <section className="signals">
          <button type="button" className="signals-toggle" onClick={() => setShowSignals((v) => !v)} aria-expanded={showSignals}>
            <span>
              Automatische Mustererkennung: <strong>{r.signals.length} Muster</strong> · Muster-Score {r.heuristicScore}/100
            </span>
            <ChevronDown size={18} className={showSignals ? 'chev open' : 'chev'} aria-hidden="true" />
          </button>
          {showSignals && (
            <ul className="signal-list">
              {r.signals.map((s) => (
                <li key={s.id}>
                  <span className="signal-weight" style={{ '--w': s.weight } as React.CSSProperties} />
                  <span className="signal-label">{s.label}</span>
                  {s.matches[0] && <code>{s.matches[0]}</code>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="result-footer">
        <span className="muted small">{engineLabel(r)}</span>
        <div className="result-buttons">
          <button type="button" className="btn btn-sm" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Kopiert' : 'Ergebnis kopieren'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button type="button" className="btn btn-sm" onClick={share}>
              <Share2 size={16} /> Teilen &amp; warnen
            </button>
          )}
          {onReset && (
            <button type="button" className="btn btn-sm btn-primary" onClick={onReset}>
              <RotateCcw size={16} /> Neue Prüfung
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

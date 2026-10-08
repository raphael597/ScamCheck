import { ChevronDown, CirclePlay, Pause, Play, ScanSearch, SkipForward, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mascot, MASCOT_NAME } from '../components/Mascot';
import { channelIcon, MessageMock } from '../components/MessageMock';
import { ResultView } from '../components/ResultView';
import { RiskGauge } from '../components/RiskGauge';
import { api, ApiError } from '../lib/api';
import type { AnalysisResult, DemoCase, Verdict } from '../lib/types';
import { VERDICT_STYLE } from '../lib/verdict';
import './demo.css';

type Stage = 'idle' | 'typing' | 'scanning' | 'result';

const TYPING_MS = 2200;
const MIN_SCAN_MS = 1800;
const AUTOPLAY_HOLD_MS = 9000;

export function DemoPage() {
  const [cases, setCases] = useState<DemoCase[]>([]);
  const [aiReady, setAiReady] = useState(false);
  const [useLive, setUseLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [revealed, setRevealed] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const runId = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .demoCases()
      .then((d) => {
        setCases(d.cases);
        setAiReady(d.aiReady);
        setUseLive(d.aiReady);
      })
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e.message : 'Demo konnte nicht geladen werden.'));
  }, []);

  const current = cases[index];

  const play = useCallback(
    (i: number) => {
      const demo = cases[i];
      if (!demo) return;
      const id = ++runId.current;
      setIndex(i);
      setResult(null);
      setRunError(null);
      setShowFull(false);
      setRevealed(0);
      setStage('typing');

      const step = Math.max(1, Math.ceil(demo.text.length / (TYPING_MS / 30)));
      let shown = 0;
      const timer = window.setInterval(() => {
        if (id !== runId.current) return window.clearInterval(timer);
        shown = Math.min(demo.text.length, shown + step);
        setRevealed(shown);
        if (shown >= demo.text.length) {
          window.clearInterval(timer);
          setStage('scanning');
          const started = Date.now();
          api
            .runDemo(demo.id, useLive ? 'auto' : 'sample')
            .then(async (res) => {
              const wait = MIN_SCAN_MS - (Date.now() - started);
              if (wait > 0) await new Promise((r) => setTimeout(r, wait));
              if (id !== runId.current) return;
              setResult(res);
              setVerdicts((v) => ({ ...v, [demo.id]: res.verdict }));
              setStage('result');
            })
            .catch((err: unknown) => {
              if (id !== runId.current) return;
              setRunError(err instanceof ApiError ? err.message : 'Prüfung fehlgeschlagen.');
              setStage('idle');
              setAutoplay(false);
            });
        }
      }, 30);
    },
    [cases, useLive],
  );

  // Autoplay: move on after the result has been on screen for a while.
  useEffect(() => {
    if (!autoplay || stage !== 'result' || showFull) return;
    const t = setTimeout(() => play((index + 1) % cases.length), AUTOPLAY_HOLD_MS);
    return () => clearTimeout(t);
  }, [autoplay, stage, index, cases.length, play, showFull]);

  useEffect(() => () => void (runId.current = -1), []);

  const startTour = () => {
    setAutoplay(true);
    play(stage === 'result' ? (index + 1) % cases.length : index);
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const select = (i: number) => {
    setAutoplay(false);
    play(i);
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const style = result ? VERDICT_STYLE[result.verdict] : null;
  const buddy =
    stage === 'typing'
      ? { pose: 'friendly' as const, say: 'Ich lese die Nachricht mit …' }
      : stage === 'scanning'
        ? { pose: 'curious' as const, say: useLive ? 'Ich vergleiche Muster, prüfe Links und frage die KI …' : 'Ich vergleiche Muster und prüfe die Links …' }
        : style
          ? { pose: style.pose, say: style.say, motion: style.motion }
          : { pose: 'friendly' as const, say: `Wähle ein Beispiel oder starte den Durchlauf – ich zeige dir, wie ich Betrug erkenne!` };

  const highlights = result?.redFlags.filter((f) => f.evidence).map((f) => ({ text: f.evidence, severity: f.severity })) ?? [];

  return (
    <div className="container demo-page">
      <header className="page-head demo-head">
        <div>
          <span className="eyebrow">Demo-Durchlauf</span>
          <h1>So erkennt {MASCOT_NAME} Betrug</h1>
          <p className="lead">Zehn Beispiele aus dem Alltag – neun Maschen und eine harmlose Nachricht zum Vergleich. Starte den Durchlauf und sieh zu, wie {MASCOT_NAME} die Warnsignale findet.</p>
          <div className="demo-controls">
            {autoplay ? (
              <button type="button" className="btn btn-lg" onClick={() => setAutoplay(false)}>
                <Pause size={20} aria-hidden="true" /> Durchlauf pausieren
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={startTour} disabled={!cases.length}>
                <CirclePlay size={20} aria-hidden="true" /> {stage === 'idle' ? 'Durchlauf starten' : 'Durchlauf fortsetzen'}
              </button>
            )}
            <button type="button" className="btn btn-lg" onClick={() => play((index + 1) % Math.max(1, cases.length))} disabled={!cases.length || stage === 'typing' || stage === 'scanning'}>
              <SkipForward size={20} aria-hidden="true" /> Nächstes Beispiel
            </button>
          </div>
          <div className="demo-mode">
            {aiReady ? (
              <label className="toggle">
                <input type="checkbox" checked={useLive} onChange={(e) => setUseLive(e.target.checked)} />
                <span>
                  Live mit KI prüfen <small className="muted">(zählt zum Prüf-Limit)</small>
                </span>
              </label>
            ) : (
              <span className="badge">
                <Sparkles size={13} aria-hidden="true" /> Beispiel-Ergebnisse + echte Mustererkennung – für Live-KI einen Anbieter im Betreiber-Bereich eintragen
              </span>
            )}
          </div>
        </div>
      </header>

      {loadError && <div className="notice notice-error">{loadError}</div>}

      <nav className="case-strip" aria-label="Beispiele">
        {cases.map((c, i) => {
          const Icon = channelIcon(c.channel.kind);
          const v = verdicts[c.id];
          return (
            <button key={c.id} type="button" className={`case-chip ${i === index && stage !== 'idle' ? 'is-current' : ''} ${v ? `verdict-${v}` : ''}`} onClick={() => select(i)}>
              <span className="case-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="case-title">{c.title}</span>
              {v && <span className="case-dot" title={VERDICT_STYLE[v].label} />}
            </button>
          );
        })}
      </nav>

      <section className="demo-stage" ref={stageRef}>
        <div className="demo-left">
          {current ? (
            <>
              <div className="demo-case-head">
                <h2>{current.title}</h2>
                <p className="muted">{current.teaser}</p>
              </div>
              {stage === 'idle' ? (
                <button type="button" className="mock-placeholder" onClick={() => select(index)}>
                  <Play size={28} aria-hidden="true" />
                  <span>Beispiel abspielen</span>
                </button>
              ) : (
                <MessageMock demo={current} revealed={revealed} scanning={stage === 'scanning'} highlights={highlights} showHighlights={stage === 'result'} />
              )}
              {current.context && stage !== 'idle' && (
                <p className="demo-context">
                  <strong>Zusatzinfo:</strong> {current.context}
                </p>
              )}
            </>
          ) : (
            <div className="mock-placeholder is-loading">
              <span className="spinner" />
            </div>
          )}
        </div>

        <div className="demo-right">
          <div className="demo-buddy">
            <Mascot key={`${buddy.pose}-${stage}`} pose={buddy.pose} motion={'motion' in buddy ? buddy.motion : undefined} size={130} say={buddy.say} bubbleSide="right" />
          </div>

          {runError && <div className="notice notice-error">{runError}</div>}

          {stage === 'scanning' && (
            <div className="visor demo-scanning">
              <ScanSearch size={22} aria-hidden="true" />
              <div>
                <strong>Analyse läuft</strong>
                <span>Mustererkennung · Link-Analyse{useLive ? ' · KI-Bewertung' : ''}</span>
              </div>
              <span className="spinner" />
            </div>
          )}

          {stage === 'result' && result && (
            <div className={`visor demo-result verdict-${result.verdict}`}>
              <div className="demo-result-top">
                <RiskGauge score={result.riskScore} verdict={result.verdict} />
                <div>
                  <span className="result-pill">{result.verdictLabel}</span>
                  <h3>{result.headline}</h3>
                </div>
              </div>
              {result.redFlags.length > 0 && (
                <ul className="demo-flags">
                  {result.redFlags.slice(0, 4).map((f, i) => (
                    <li key={i} className={`sev-${f.severity}`} style={{ '--i': i } as React.CSSProperties}>
                      {f.title}
                    </li>
                  ))}
                </ul>
              )}
              {result.greenFlags.length > 0 && result.redFlags.length === 0 && (
                <ul className="demo-flags is-green">
                  {result.greenFlags.slice(0, 3).map((f, i) => (
                    <li key={i} style={{ '--i': i } as React.CSSProperties}>
                      {f.title}
                    </li>
                  ))}
                </ul>
              )}
              <div className="demo-result-foot">
                <span>{result.engine.mode === 'ai' ? `Live-KI · ${result.engine.model}` : 'Beispiel-Ergebnis + echte Mustererkennung'}</span>
                <button type="button" className="btn btn-sm" onClick={() => setShowFull((v) => !v)}>
                  {showFull ? 'Weniger' : 'Ganzes Ergebnis'} <ChevronDown size={16} className={showFull ? 'flip' : ''} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showFull && result && (
        <section className="demo-full">
          <ResultView result={result} compact />
        </section>
      )}

      <section className="demo-cta card">
        <div>
          <h2>Bereit für deine eigene Prüfung?</h2>
          <p className="muted">Füge eine Nachricht ein, die dir komisch vorkommt – {MASCOT_NAME} schaut sie sich sofort an.</p>
        </div>
        <Link to="/pruefen" className="btn btn-primary btn-lg">
          <ScanSearch size={20} aria-hidden="true" /> Jetzt selbst prüfen
        </Link>
      </section>
    </div>
  );
}

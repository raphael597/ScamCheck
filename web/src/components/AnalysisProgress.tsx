import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MASCOT_NAME, Scene } from './Mascot';
import './progress.css';

interface Props {
  ai: boolean;
  hasImages: boolean;
  /** The server opens links from the text (page inspection enabled and a link present). */
  opensLinks?: boolean;
  /** Set when the server answered – remaining steps finish quickly, then onComplete fires. */
  done: boolean;
  onComplete: () => void;
}

const STEP_MS = 650;

/** Shows Checky at work while the analysis runs. Steps follow real progress: the AI step waits for the server. */
export function AnalysisProgress({ ai, hasImages, opensLinks = false, done, onComplete }: Props) {
  const steps = useMemo(
    () => [
      hasImages ? 'Screenshot und Text werden gelesen' : 'Text wird gelesen',
      'Über 30 Betrugsmaschen werden verglichen',
      opensLinks ? 'Verlinkte Seite wird abgeschirmt geöffnet – ohne Skripte' : 'Aufbau der Links wird untersucht',
      ...(ai ? ['KI wägt alle Hinweise ab'] : []),
      'Empfehlung wird formuliert',
    ],
    [ai, hasImages, opensLinks],
  );
  // The step that waits for the server: the AI step, otherwise the last one.
  const waitIndex = ai ? 3 : steps.length - 1;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active < waitIndex) {
      const t = setTimeout(() => setActive((a) => a + 1), STEP_MS);
      return () => clearTimeout(t);
    }
    if (done && active < steps.length) {
      const t = setTimeout(() => setActive((a) => a + 1), 320);
      return () => clearTimeout(t);
    }
    if (done && active >= steps.length) {
      const t = setTimeout(onComplete, 350);
      return () => clearTimeout(t);
    }
  }, [active, done, waitIndex, steps.length, onComplete]);

  const progress = Math.min(1, active / steps.length);

  return (
    <section className="visor progress-panel" aria-live="polite" aria-busy={!done}>
      <Scene name="laptop" className="progress-scene" />
      <div className="progress-body">
        <span className="eyebrow progress-eyebrow">{MASCOT_NAME} prüft für dich</span>
        <h2>Einen Moment, ich schaue ganz genau hin …</h2>
        <div className="progress-bar" style={{ '--p': progress } as React.CSSProperties}>
          <span />
        </div>
        <ol className="progress-steps">
          {steps.map((label, i) => {
            const state = i < active ? 'done' : i === active ? 'active' : 'todo';
            return (
              <li key={label} className={`pstep is-${state}`}>
                <span className="pstep-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : state === 'active' ? <span className="spinner" /> : null}</span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
        <p className="progress-note">Deine Eingabe wird nicht gespeichert.</p>
      </div>
    </section>
  );
}

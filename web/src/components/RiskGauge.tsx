import { useEffect, useState } from 'react';
import type { Verdict } from '../lib/types';

const SEGMENTS: { to: number; color: string }[] = [
  { to: 20, color: 'var(--safe)' },
  { to: 40, color: 'var(--unclear)' },
  { to: 65, color: 'var(--suspicious)' },
  { to: 85, color: 'var(--likely)' },
  { to: 100, color: 'var(--scam)' },
];

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const R = 80;
const CX = 100;
const CY = 100;

function polar(score: number) {
  const angle = Math.PI * (1 - score / 100);
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function arc(from: number, to: number) {
  const a = polar(from);
  const b = polar(to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Semicircular risk meter with an animated fill arc and counting score. */
export function RiskGauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const value = useCountUp(score);
  const knob = polar(value);
  let prev = 0;
  return (
    <div className={`gauge verdict-${verdict}`} role="img" aria-label={`Betrugsrisiko ${score} von 100`}>
      <svg viewBox="0 0 200 118">
        {SEGMENTS.map((s) => {
          const d = arc(prev + 0.8, s.to - 0.8);
          prev = s.to;
          return <path key={s.to} d={d} stroke={s.color} strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.28" />;
        })}
        {value > 0 && <path d={arc(0, Math.max(1, value))} stroke="var(--v)" strokeWidth="12" fill="none" strokeLinecap="round" className="gauge-fill" />}
        <circle cx={knob.x} cy={knob.y} r="9" fill="var(--v)" opacity="0.25" />
        <circle cx={knob.x} cy={knob.y} r="5.5" fill="var(--visor-ink)" stroke="var(--v)" strokeWidth="3" />
      </svg>
      <div className="gauge-value">
        <span className="gauge-number">{value}</span>
        <span className="gauge-unit">/100 Risiko</span>
      </div>
    </div>
  );
}

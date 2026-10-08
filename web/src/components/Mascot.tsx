import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './mascot.css';

export const MASCOT_NAME = 'Checky';

export type Pose = 'hero' | 'friendly' | 'curious' | 'protect' | 'reliable';
export type MascotMotion = 'float' | 'wave' | 'bounce' | 'think' | 'alert' | 'none';

interface PoseGeometry {
  alt: string;
  ratio: number;
  /** Eye area for the blink overlay, in % of the image box. */
  eyes: { left: number; top: number; width: number; height: number; color: string };
  /** Antenna ball centre and diameter in % of image width/height. */
  antenna: { x: number; y: number; d: number };
}

const POSES: Record<Pose, PoseGeometry> = {
  hero: {
    alt: `${MASCOT_NAME} hält eine Lupe und zeigt den Daumen nach oben`,
    ratio: 529 / 616,
    eyes: { left: 25.5, top: 25.3, width: 39.7, height: 12.7, color: '#021634' },
    antenna: { x: 40.7, y: 3.6, d: 9.1 },
  },
  friendly: {
    alt: `${MASCOT_NAME} winkt freundlich`,
    ratio: 250 / 283,
    eyes: { left: 37.2, top: 24.4, width: 41.2, height: 14.8, color: '#021736' },
    antenna: { x: 69, y: 6, d: 10.4 },
  },
  curious: {
    alt: `${MASCOT_NAME} schaut neugierig und überlegt`,
    ratio: 183 / 265,
    eyes: { left: 30.6, top: 22.6, width: 52.5, height: 21.1, color: '#011732' },
    antenna: { x: 47.5, y: 4.1, d: 10 },
  },
  protect: {
    alt: `${MASCOT_NAME} hält entschlossen einen Schutzschild`,
    ratio: 226 / 278,
    eyes: { left: 24.8, top: 28.8, width: 46.9, height: 15.1, color: '#011633' },
    antenna: { x: 50.9, y: 4.3, d: 10.2 },
  },
  reliable: {
    alt: `${MASCOT_NAME} zwinkert und zeigt den Daumen nach oben`,
    ratio: 233 / 273,
    eyes: { left: 51.1, top: 22.7, width: 15.5, height: 14.7, color: '#031f3f' },
    antenna: { x: 36.3, y: 4.4, d: 9.4 },
  },
};

export const DEFAULT_MOTION: Record<Pose, MascotMotion> = {
  hero: 'float',
  friendly: 'wave',
  curious: 'think',
  protect: 'alert',
  reliable: 'bounce',
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Types out a sentence like Checky is speaking. */
export function useTypewriter(text: string, enabled = true, cps = 55) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(enabled && !reduced ? '' : text);
  useEffect(() => {
    if (!enabled || reduced) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.round(cps / 30));
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 1000 / 30);
    return () => window.clearInterval(id);
  }, [text, enabled, reduced, cps]);
  return shown;
}

interface MascotProps {
  pose: Pose;
  /** CSS width of the image, e.g. 180 or "min(40vw, 320px)". */
  size?: number | string;
  motion?: MascotMotion;
  blink?: boolean;
  /** Lean slightly toward the pointer. */
  tilt?: boolean;
  /** Speech bubble content. Strings are typed out. */
  say?: ReactNode;
  bubbleSide?: 'left' | 'right' | 'top';
  typing?: boolean;
  shadow?: boolean;
  className?: string;
  decorative?: boolean;
}

export function Mascot({
  pose,
  size = 200,
  motion,
  blink = true,
  tilt = false,
  say,
  bubbleSide = 'right',
  typing = true,
  shadow = true,
  className = '',
  decorative = false,
}: MascotProps) {
  const geo = POSES[pose];
  const m = motion ?? DEFAULT_MOTION[pose];
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Every instance blinks on its own rhythm so a page full of Checkys doesn't blink in sync.
  const blinkStyle = useMemo(
    () => ({ '--blink-delay': `${(Math.random() * 3).toFixed(2)}s`, '--blink-duration': `${(4.2 + Math.random() * 2.4).toFixed(2)}s` }),
    [],
  );

  useEffect(() => {
    if (!tilt || reduced) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (rect.top + rect.height / 3)) / window.innerHeight;
        el.style.setProperty('--tilt-r', `${(dx * 7).toFixed(2)}deg`);
        el.style.setProperty('--tilt-x', `${(dx * 14).toFixed(1)}px`);
        el.style.setProperty('--tilt-y', `${(dy * 8).toFixed(1)}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [tilt, reduced]);

  const width = typeof size === 'number' ? `${size}px` : size;
  const text = typeof say === 'string' ? say : '';
  const typed = useTypewriter(text, typing && Boolean(text));

  return (
    <figure className={`mascot mascot--${pose} mascot--${m} bubble-${bubbleSide} ${className}`} style={{ '--w': width } as CSSProperties}>
      <div className="mascot-stage" ref={ref}>
        <div className="mascot-tilt">
          <div className="mascot-body">
            <img src={`/mascot/${pose}.webp`} alt={decorative ? '' : geo.alt} width={Math.round(geo.ratio * 400)} height={400} draggable={false} />
            {blink && (
              <span
                className="mascot-blink"
                aria-hidden="true"
                style={
                  {
                    left: `${geo.eyes.left}%`,
                    top: `${geo.eyes.top}%`,
                    width: `${geo.eyes.width}%`,
                    height: `${geo.eyes.height}%`,
                    '--visor': geo.eyes.color,
                    ...blinkStyle,
                  } as CSSProperties
                }
              />
            )}
            <span
              className="mascot-antenna"
              aria-hidden="true"
              style={{ left: `${geo.antenna.x}%`, top: `${geo.antenna.y}%`, width: `${geo.antenna.d * 2.2}%` }}
            />
            {m === 'think' && (
              <span className="mascot-thoughts" aria-hidden="true">
                <i>?</i>
                <i>?</i>
                <i>?</i>
              </span>
            )}
            {m === 'alert' && <span className="mascot-ring" aria-hidden="true" />}
          </div>
        </div>
        {shadow && <span className="mascot-shadow" aria-hidden="true" />}
      </div>
      {say && (
        <figcaption className="bubble" aria-live="polite">
          {text ? (
            <>
              <span className="bubble-sizer" aria-hidden="true">
                {text}
              </span>
              <span className="bubble-text">{typed}</span>
            </>
          ) : (
            say
          )}
        </figcaption>
      )}
    </figure>
  );
}

export type SceneName = 'laptop' | 'peek' | 'warning';

const SCENE_ALT: Record<SceneName, string> = {
  laptop: `${MASCOT_NAME} sitzt am Laptop und prüft Nachrichten`,
  peek: `${MASCOT_NAME} schaut neugierig um die Ecke`,
  warning: `${MASCOT_NAME} zeigt auf eine Warnmeldung`,
};

/** The illustrated scenes from the brand sheet, with small animated glows layered on top. */
export function Scene({ name, className = '', children }: { name: SceneName; className?: string; children?: ReactNode }) {
  return (
    <div className={`scene scene--${name} ${className}`}>
      <img src={`/mascot/scene-${name}.webp`} alt={SCENE_ALT[name]} draggable={false} />
      {name === 'laptop' && (
        <>
          <span className="scene-glow glow-hook" aria-hidden="true" />
          <span className="scene-glow glow-shield" aria-hidden="true" />
          <span className="scene-scan" aria-hidden="true" />
        </>
      )}
      {name === 'warning' && <span className="scene-glow glow-warning" aria-hidden="true" />}
      {children}
    </div>
  );
}

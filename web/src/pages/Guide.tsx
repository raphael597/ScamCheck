import { ScanSearch, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mascot, MASCOT_NAME } from '../components/Mascot';
import { BASICS, GOLDEN_RULES, GUIDE } from '../data/guide';
import './guide.css';

export function GuidePage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [hash]);

  return (
    <div className="container guide-page">
      <header className="page-head guide-head">
        <div>
          <span className="eyebrow">Ratgeber</span>
          <h1>Die häufigsten Maschen – und wie du sie erkennst</h1>
          <p className="lead">Wer die Tricks kennt, fällt seltener darauf herein. Hier erklärt {MASCOT_NAME}, wie die bekanntesten Betrugsmaschen funktionieren.</p>
        </div>
        <Mascot pose="protect" size={170} decorative />
      </header>

      <section className="visor rules">
        <h2>
          <ShieldCheck size={26} aria-hidden="true" /> Die 5 goldenen Regeln
        </h2>
        <ol>
          {GOLDEN_RULES.map((r, i) => (
            <li key={r.title} style={{ '--i': i } as React.CSSProperties}>
              <strong>{r.title}</strong>
              <span>{r.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Maschen">
          <span className="guide-toc-title">Maschen</span>
          {GUIDE.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title}
            </a>
          ))}
          <a href="#basics">Grundschutz</a>
        </nav>

        <div className="guide-entries">
          {GUIDE.map((g) => (
            <article key={g.id} id={g.id} className="card card-pad guide-entry">
              <h2>{g.title}</h2>
              <p className="guide-short">{g.short}</p>
              <h3>So läuft’s ab</h3>
              <p>{g.how}</p>
              <div className="guide-cols">
                <div className="guide-signs">
                  <h3>Daran erkennst du’s</h3>
                  <ul>
                    {g.signs.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="guide-protect">
                  <h3>So schützt du dich</h3>
                  <ul>
                    {g.protect.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}

          <article id="basics" className="card card-pad guide-entry">
            <h2>Grundschutz für jeden Tag</h2>
            <p className="guide-short">Fünf Gewohnheiten, die dich gegen die meisten Angriffe wappnen.</p>
            <ul className="basics">
              {BASICS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </article>

          <div className="guide-cta">
            <p>Unsicher bei einer konkreten Nachricht?</p>
            <Link to="/pruefen" className="btn btn-primary btn-lg">
              <ScanSearch size={20} aria-hidden="true" /> Von {MASCOT_NAME} prüfen lassen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

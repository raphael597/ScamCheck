import { ArrowRight, CirclePlay, HeartHandshake, Link2, Lock, Megaphone, ScanSearch, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mascot, MASCOT_NAME, Scene, type Pose } from '../components/Mascot';
import { useMeta } from '../hooks/useMeta';
import { api } from '../lib/api';
import type { NewsItem } from '../lib/types';
import { relativeTime } from '../lib/verdict';
import './home.css';

const VALUES: { pose: Pose; label: string; title: string; text: string }[] = [
  { pose: 'friendly', label: 'Freundlich', title: 'Kein Fachchinesisch', text: 'Klare Worte statt Technik-Sprech. Und niemals ein erhobener Zeigefinger.' },
  { pose: 'curious', label: 'Neugierig', title: 'Schaut genau hin', text: 'Prüft Sprache, Links, Zahlungswege und über 30 bekannte Maschen.' },
  { pose: 'protect', label: 'Schützend', title: 'Deine Daten bleiben bei dir', text: 'Nichts wird gespeichert. Dein Verlauf liegt nur in deinem Browser.' },
  { pose: 'reliable', label: 'Zuverlässig', title: 'Sagt dir, was zu tun ist', text: 'Konkrete nächste Schritte – auch wenn du schon geklickt hast.' },
];

const ORBIT = [
  { icon: TriangleAlert, text: 'Zeitdruck erkannt', tone: 'warn' },
  { icon: Link2, text: 'Link: falsche Domain', tone: 'bad' },
  { icon: ShieldCheck, text: 'Offizielle Absenderin', tone: 'good' },
];

export function HomePage() {
  const navigate = useNavigate();
  const { meta } = useMeta();
  const [quick, setQuick] = useState('');
  const [warnings, setWarnings] = useState<NewsItem[]>([]);

  useEffect(() => {
    api
      .news({ warnings: true, limit: 3 })
      .then((r) => setWarnings(r.items))
      .catch(() => setWarnings([]));
  }, []);

  const startCheck = () => navigate('/pruefen', { state: { text: quick } });

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow rise">Gegen Cyberkriminalität</span>
          <h1 className="rise" style={{ '--i': 1 } as React.CSSProperties}>
            Ist das Betrug?
            <br />
            <span className="hero-accent">Frag einfach {MASCOT_NAME}.</span>
          </h1>
          <p className="lead rise" style={{ '--i': 2 } as React.CSSProperties}>
            Komische SMS, verdächtige Kleinanzeige, zu gutes Angebot? Einfügen, prüfen lassen – und in Sekunden wissen, worauf du achten musst.
          </p>

          <form
            className="quick-check rise"
            style={{ '--i': 3 } as React.CSSProperties}
            onSubmit={(e) => {
              e.preventDefault();
              startCheck();
            }}
          >
            <label htmlFor="quick" className="sr-only">
              Verdächtigen Text einfügen
            </label>
            <textarea id="quick" rows={2} placeholder="Verdächtige Nachricht hier einfügen …" value={quick} onChange={(e) => setQuick(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-lg">
              <ScanSearch size={20} aria-hidden="true" /> Prüfen
            </button>
          </form>

          <div className="hero-links rise" style={{ '--i': 4 } as React.CSSProperties}>
            <Link to="/demo" className="btn btn-ghost">
              <CirclePlay size={18} aria-hidden="true" /> Demo ansehen
            </Link>
            <ul className="trust-row">
              <li>
                <Sparkles size={15} aria-hidden="true" /> Kostenlos
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> Keine Speicherung
              </li>
              <li>
                <HeartHandshake size={15} aria-hidden="true" /> Verständlich
              </li>
            </ul>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-halo" aria-hidden="true" />
          <Mascot pose="hero" size="min(78vw, 400px)" tilt />
          <ul className="orbit" aria-hidden="true">
            {ORBIT.map(({ icon: Icon, text, tone }, i) => (
              <li key={text} className={`orbit-card tone-${tone}`} style={{ '--i': i } as React.CSSProperties}>
                <Icon size={16} />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {meta && meta.stats.totalChecks > 0 && (
        <section className="container stats-strip">
          <div>
            <strong>{meta.stats.totalChecks.toLocaleString('de-DE')}</strong>
            <span>Prüfungen bisher</span>
          </div>
          <div>
            <strong>{meta.stats.warned.toLocaleString('de-DE')}</strong>
            <span>Mal vor Betrug gewarnt</span>
          </div>
          <div>
            <strong>{meta.ai.ready ? 'KI + Muster' : 'Muster'}</strong>
            <span>Prüfmethode</span>
          </div>
        </section>
      )}

      <section className="section container">
        <div className="section-head">
          <span className="eyebrow">So funktioniert’s</span>
          <h2>Drei Schritte zu mehr Sicherheit</h2>
        </div>
        <ol className="how-steps">
          <li>
            <span className="how-num">1</span>
            <h3>Einfügen</h3>
            <p>Text kopieren, Link einfügen oder Screenshot hochladen. Egal ob SMS, E-Mail, WhatsApp oder Anzeige.</p>
          </li>
          <li>
            <span className="how-num">2</span>
            <h3>{MASCOT_NAME} prüft</h3>
            <p>Mustererkennung, Link-Analyse und – wenn aktiviert – eine KI wägen alle Hinweise sorgfältig ab.</p>
          </li>
          <li>
            <span className="how-num">3</span>
            <h3>Klar handeln</h3>
            <p>Du bekommst eine verständliche Einschätzung, die Warnsignale mit Belegen und konkrete nächste Schritte.</p>
          </li>
        </ol>
      </section>

      <section className="section values-section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Das ist {MASCOT_NAME}</span>
            <h2>Dein Begleiter gegen Online-Betrug</h2>
            <p className="lead">Betrüger setzen auf Stress, Angst und Gier. {MASCOT_NAME} setzt auf Ruhe, Klarheit und ein offenes Ohr.</p>
          </div>
          <ul className="values">
            {VALUES.map((v, i) => (
              <li key={v.label} className="value-card" style={{ '--i': i } as React.CSSProperties}>
                <div className="value-pose">
                  <Mascot pose={v.pose} size={150} decorative shadow />
                </div>
                <span className="value-label">{v.label}</span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section container demo-band">
        <div className="visor demo-band-inner">
          <div className="demo-band-copy">
            <span className="eyebrow demo-eyebrow">Demo-Durchlauf</span>
            <h2>Sieh {MASCOT_NAME} bei der Arbeit zu</h2>
            <p>Zehn echte Maschen aus dem Alltag – von der Paket-SMS bis zur falschen Wohnungsanzeige. Schau zu, wie {MASCOT_NAME} die Warnsignale findet und markiert.</p>
            <Link to="/demo" className="btn btn-primary btn-lg">
              <CirclePlay size={20} aria-hidden="true" /> Demo starten
            </Link>
          </div>
          <Scene name="laptop" className="demo-band-scene" />
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="section container">
          <div className="warn-head">
            <div className="section-head">
              <span className="eyebrow">Aktuelle Warnungen</span>
              <h2>Diese Maschen sind gerade unterwegs</h2>
            </div>
            <Link to="/news" className="btn">
              Alle News <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="warn-layout">
            <Scene name="warning" className="warn-scene" />
            <ul className="warn-list">
              {warnings.map((w) => {
                const body = (
                  <>
                    <Megaphone size={18} aria-hidden="true" />
                    <span>
                      <strong>{w.title}</strong>
                      <small>
                        {w.source.name} · {relativeTime(w.publishedAt)}
                      </small>
                    </span>
                  </>
                );
                return (
                  <li key={w.id}>
                    {w.link.startsWith('/') ? (
                      <Link to={w.link} className="warn-item">
                        {body}
                      </Link>
                    ) : (
                      <a href={w.link} target="_blank" rel="noopener noreferrer" className="warn-item">
                        {body}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="section container">
        <div className="help-band card">
          <Mascot pose="friendly" size={170} decorative />
          <div>
            <h2>Schon reingefallen? Das ist kein Grund zur Scham.</h2>
            <p className="lead">Betrüger sind Profis. Es trifft kluge, vorsichtige Menschen jeden Alters. Wichtig ist jetzt: schnell und ruhig handeln.</p>
            <Link to="/hilfe" className="btn btn-primary">
              Soforthilfe öffnen <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

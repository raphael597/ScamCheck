import { BookOpen, CirclePlay, House, LifeBuoy, Lock, Monitor, Moon, Newspaper, ScanSearch, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useMeta } from '../hooks/useMeta';
import { Logo } from './Logo';
import './layout.css';

const NAV = [
  { to: '/', label: 'Start', icon: House, end: true },
  { to: '/pruefen', label: 'Prüfen', icon: ScanSearch },
  { to: '/demo', label: 'Demo', icon: CirclePlay },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/ratgeber', label: 'Ratgeber', icon: BookOpen },
];

/** Company behind the site, shown in the footer. */
const OPERATOR = 'Veydex UG (haftungsbeschränkt)';

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('scamcheck-theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('scamcheck-theme');
      else localStorage.setItem('scamcheck-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const next = () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'));
  return [theme, next];
}

export function Layout({ children }: { children: ReactNode }) {
  const [theme, nextTheme] = useTheme();
  const { meta } = useMeta();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System';

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container header-inner">
          <Link to="/" className="brand-link" aria-label="ScamCheck – Startseite">
            <Logo />
          </Link>
          <nav className="main-nav" aria-label="Hauptnavigation">
            {NAV.slice(1).map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <NavLink to="/hilfe" className="nav-help">
              <LifeBuoy size={18} aria-hidden="true" />
              <span>Soforthilfe</span>
            </NavLink>
            <button type="button" className="icon-btn" onClick={nextTheme} title={`Farbschema: ${themeLabel}`} aria-label={`Farbschema wechseln (aktuell: ${themeLabel})`}>
              <ThemeIcon size={19} />
            </button>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo tagline />
            <p className="muted">
              ScamCheck hilft dir, Betrug zu erkennen – freundlich, verständlich und ohne deine Inhalte zu speichern. Die Einschätzung ist eine Hilfe, keine Garantie.
            </p>
          </div>
          <div>
            <h4>Entdecken</h4>
            <ul>
              <li>
                <Link to="/pruefen">Nachricht prüfen</Link>
              </li>
              <li>
                <Link to="/demo">Demo-Durchlauf</Link>
              </li>
              <li>
                <Link to="/news">Sicherheits-News</Link>
              </li>
              <li>
                <Link to="/ratgeber">Betrugsmaschen</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Im Notfall</h4>
            <ul className="footer-emergency">
              <li>
                <strong>116 116</strong> Karten- &amp; Kontosperre
              </li>
              <li>
                <strong>110</strong> Polizei (DE) · <strong>133</strong> (AT) · <strong>117</strong> (CH)
              </li>
              <li>
                <Link to="/hilfe">Schritt-für-Schritt-Hilfe</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Datenschutz</h4>
            <p className="muted small">
              Eingaben werden nur für die Prüfung verarbeitet und nicht gespeichert. Ist ein KI-Anbieter aktiv, wird der Text dafür an diesen übermittelt.
              {meta?.web?.fetchPages ? ' Enthaltene Links ruft der Server zur Prüfung ab.' : ''} Dein Verlauf bleibt nur in diesem Browser.
            </p>
            <Link to="/admin" className="admin-link">
              <Lock size={14} aria-hidden="true" /> Betreiber-Bereich
            </Link>
          </div>
        </div>
        <div className="container footer-legal">
          <span>
            © {new Date().getFullYear()} ScamCheck · Diese Seite ist Teil der <strong>{OPERATOR}</strong>
          </span>
        </div>
      </footer>

      <nav className="bottom-nav" aria-label="Schnellnavigation">
        {NAV.slice(0, 4).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-link">
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/hilfe" className="bottom-link bottom-help">
          <LifeBuoy size={22} aria-hidden="true" />
          <span>Hilfe</span>
        </NavLink>
      </nav>
    </div>
  );
}

import { ArrowRight, ExternalLink, Info, Megaphone, RefreshCw, Rss, Search, ShieldAlert, Sparkles, Bug, Database, Lock, Smartphone, Bot, TriangleAlert, Fish } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mascot, MASCOT_NAME, Scene } from '../components/Mascot';
import { useMeta } from '../hooks/useMeta';
import { api, ApiError } from '../lib/api';
import type { NewsItem, NewsResponse, Topic } from '../lib/types';
import { relativeTime } from '../lib/verdict';
import './news.css';

const TOPICS: { id: Topic | ''; label: string }[] = [
  { id: '', label: 'Alle' },
  { id: 'scam', label: 'Betrug & Maschen' },
  { id: 'phishing', label: 'Phishing' },
  { id: 'malware', label: 'Schadsoftware' },
  { id: 'breach', label: 'Datenlecks' },
  { id: 'vulnerability', label: 'Sicherheitslücken' },
  { id: 'privacy', label: 'Datenschutz' },
  { id: 'ai', label: 'KI & Deepfakes' },
  { id: 'mobile', label: 'Smartphone' },
];

const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.id, t.label])) as Record<Topic, string>;

const TOPIC_ICON: Record<Topic, typeof Bug> = {
  scam: ShieldAlert,
  phishing: Fish,
  malware: Bug,
  breach: Database,
  vulnerability: TriangleAlert,
  privacy: Lock,
  ai: Bot,
  mobile: Smartphone,
};

const PAGE = 24;

function ArticleLink({ item, className, children }: { item: NewsItem; className?: string; children: React.ReactNode }) {
  if (item.link.startsWith('/')) {
    return (
      <Link to={item.link} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function Explain({ id }: { id: string }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: { summary: string; affected: string; actions: string[] } }>({ loading: true });
  useEffect(() => {
    api
      .explainNews(id)
      .then((data) => setState({ loading: false, data }))
      .catch((e: unknown) => setState({ loading: false, error: e instanceof ApiError ? e.message : 'Erklärung fehlgeschlagen.' }));
  }, [id]);
  return (
    <div className="explain">
      <img src="/mascot/friendly.webp" alt="" className="explain-avatar" />
      <div>
        {state.loading && (
          <p className="explain-loading">
            <span className="spinner" /> {MASCOT_NAME} liest den Artikel …
          </p>
        )}
        {state.error && <p className="explain-error">{state.error}</p>}
        {state.data && (
          <>
            <p>
              <strong>Worum geht’s?</strong> {state.data.summary}
            </p>
            <p>
              <strong>Betrifft mich das?</strong> {state.data.affected}
            </p>
            {state.data.actions.length > 0 && (
              <ul>
                {state.data.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NewsCard({ item, canExplain, index }: { item: NewsItem; canExplain: boolean; index: number }) {
  const [explain, setExplain] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const primary = item.topics[0];
  const Icon = primary ? TOPIC_ICON[primary] : Rss;
  return (
    <article className={`news-card ${item.isWarning ? 'is-warning' : ''}`} style={{ '--i': index % PAGE } as React.CSSProperties}>
      <ArticleLink item={item} className="news-media">
        {item.hasImage && !imgFailed ? (
          <img src={`/api/news/image/${item.id}`} alt="" loading="lazy" onError={() => setImgFailed(true)} />
        ) : (
          <span className={`news-placeholder topic-${primary ?? 'none'}`}>
            <Icon size={34} aria-hidden="true" />
          </span>
        )}
        {item.isWarning && (
          <span className="news-flag">
            <Megaphone size={13} aria-hidden="true" /> Warnung
          </span>
        )}
      </ArticleLink>
      <div className="news-body">
        <div className="news-meta">
          <span className="news-source">{item.source.name}</span>
          <span className="news-lang" title={item.source.lang === 'de' ? 'Deutsch' : 'Englisch'}>
            {item.source.lang.toUpperCase()}
          </span>
          <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
        </div>
        <h3>
          <ArticleLink item={item}>{item.title}</ArticleLink>
        </h3>
        {item.summary && <p className="news-summary">{item.summary}</p>}
        {item.topics.length > 0 && (
          <div className="news-topics">
            {item.topics.slice(0, 3).map((t) => (
              <span key={t} className="badge">
                {TOPIC_LABEL[t]}
              </span>
            ))}
          </div>
        )}
        <div className="news-actions">
          <ArticleLink item={item} className="btn btn-sm">
            {item.link.startsWith('/') ? (
              <>
                Im Ratgeber lesen <ArrowRight size={14} aria-hidden="true" />
              </>
            ) : (
              <>
                Artikel lesen <ExternalLink size={14} aria-hidden="true" />
              </>
            )}
          </ArticleLink>
          {canExplain && !item.isSample && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExplain((v) => !v)} aria-expanded={explain}>
              <Sparkles size={15} aria-hidden="true" /> Erklär’s mir einfach
            </button>
          )}
        </div>
        {explain && <Explain id={item.id} />}
      </div>
    </article>
  );
}

export function NewsPage() {
  const { meta } = useMeta();
  const [topic, setTopic] = useState<Topic | ''>('');
  const [lang, setLang] = useState<'' | 'de' | 'en'>('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<NewsResponse | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<NewsItem[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    (offset: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      api
        .news({ topic: topic || undefined, lang: lang || undefined, warnings: warningsOnly, q: debounced || undefined, limit: PAGE, offset })
        .then((res) => {
          if (id !== reqId.current) return;
          setData(res);
          setItems((prev) => (offset ? [...prev, ...res.items] : res.items));
        })
        .catch((e: unknown) => id === reqId.current && setError(e instanceof ApiError ? e.message : 'News konnten nicht geladen werden.'))
        .finally(() => id === reqId.current && setLoading(false));
    },
    [topic, lang, warningsOnly, debounced],
  );

  useEffect(() => load(0), [load]);

  useEffect(() => {
    api
      .news({ warnings: true, lang: 'de', limit: 6 })
      .then((r) => setWarnings(r.items))
      .catch(() => {});
  }, []);

  const failing = data?.sources.filter((s) => s.enabled && s.ok === false) ?? [];
  const canExplain = Boolean(meta?.news.aiExplain);

  return (
    <div className="container news-page">
      <header className="page-head news-head">
        <div>
          <span className="eyebrow">Cyber-News</span>
          <h1>Was gibt’s Neues in der Cyber-Welt?</h1>
          <p className="lead">
            Aktuelle Warnungen vor Betrugsmaschen und die wichtigsten Nachrichten aus der IT-Sicherheit – gesammelt aus {data?.sources.filter((s) => s.enabled).length ?? 'vielen'} Quellen
            {canExplain ? `, auf Wunsch von ${MASCOT_NAME} einfach erklärt.` : '.'}
          </p>
        </div>
        <Scene name="peek" className="news-peek" />
      </header>

      {data?.isSample && (
        <div className="notice notice-warn">
          <Info size={18} aria-hidden="true" />
          <span>Die Live-Quellen sind gerade nicht erreichbar. Du siehst allgemeine Beispielmeldungen zu bekannten Maschen.</span>
        </div>
      )}

      {warnings.length > 0 && !data?.isSample && (
        <section className="warn-rail" aria-label="Aktuelle Warnungen">
          <h2>
            <Megaphone size={20} aria-hidden="true" /> Aktuelle Warnungen
          </h2>
          <div className="warn-rail-track">
            {warnings.map((w) => (
              <ArticleLink key={w.id} item={w} className="warn-rail-card">
                <span className="warn-rail-source">
                  {w.source.name} · {relativeTime(w.publishedAt)}
                </span>
                <strong>{w.title}</strong>
              </ArticleLink>
            ))}
          </div>
        </section>
      )}

      <div className="news-filters">
        <div className="chip-row" role="group" aria-label="Thema">
          {TOPICS.map((t) => (
            <button key={t.id || 'all'} type="button" className="chip" aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="news-filter-row">
          <label className="news-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">News durchsuchen</span>
            <input className="input" type="search" placeholder="Suchen, z. B. „PayPal“ oder „Kleinanzeigen“" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Sprache">
            {(['', 'de', 'en'] as const).map((l) => (
              <button key={l || 'all'} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l === '' ? 'Alle Sprachen' : l === 'de' ? 'Deutsch' : 'Englisch'}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={warningsOnly} onChange={(e) => setWarningsOnly(e.target.checked)} />
            Nur Warnungen
          </label>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="news-empty">
          <Mascot pose="curious" size={140} say="Hmm, dazu habe ich gerade nichts gefunden. Probier einen anderen Filter!" bubbleSide="right" />
        </div>
      )}

      <div className="news-grid">
        {items.map((item, i) => (
          <NewsCard key={item.id} item={item} canExplain={canExplain} index={i} />
        ))}
      </div>

      <div className="news-more">
        {loading && <span className="spinner" aria-label="Lädt" />}
        {!loading && data && items.length < data.total && (
          <button type="button" className="btn" onClick={() => load(items.length)}>
            <RefreshCw size={16} aria-hidden="true" /> Mehr laden ({data.total - items.length} weitere)
          </button>
        )}
      </div>

      {data && (
        <footer className="news-sources">
          <h3>
            <Rss size={18} aria-hidden="true" /> Quellen
          </h3>
          <ul>
            {data.sources
              .filter((s) => s.enabled)
              .map((s) => (
                <li key={s.id} className={s.ok === false ? 'is-down' : s.ok ? 'is-ok' : ''} title={s.lastError ?? undefined}>
                  <span className="dot" /> {s.name}
                </li>
              ))}
          </ul>
          {failing.length > 0 && <p className="muted small">{failing.length} Quelle(n) gerade nicht erreichbar.</p>}
          {data.updatedAt && <p className="muted small">Zuletzt aktualisiert {relativeTime(data.updatedAt)}.</p>}
        </footer>
      )}
    </div>
  );
}

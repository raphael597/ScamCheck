import { Bot, ChartBar, CircleAlert, CircleCheck, KeyRound, Lock, LogOut, Plus, RefreshCw, Rss, ScrollText, Server, Trash, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Mascot, MASCOT_NAME } from '../components/Mascot';
import { useMeta } from '../hooks/useMeta';
import { api, ApiError } from '../lib/api';
import type { AdminSettings, AdminStats, FeedConfig, ProviderId, SourceStatus } from '../lib/types';
import { relativeTime, VERDICT_STYLE } from '../lib/verdict';
import './admin.css';

type Tab = 'llm' | 'prompt' | 'news' | 'limits';

const PROVIDERS: { id: ProviderId; name: string; text: string }[] = [
  { id: 'none', name: 'Keine KI', text: 'Nur die eingebaute Mustererkennung. Kostenlos, offline, ohne Bildanalyse.' },
  { id: 'openai', name: 'OpenAI', text: 'GPT-Modelle mit strukturierter JSON-Ausgabe und Bildanalyse.' },
  { id: 'anthropic', name: 'Anthropic Claude', text: 'Claude-Modelle mit strukturierter Ausgabe und Bildanalyse.' },
  { id: 'openai_compatible', name: 'OpenAI-kompatibel', text: 'Ollama, LM Studio, OpenRouter, Mistral, Groq, Gemini u. v. m.' },
];

const MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  none: [],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini', 'gpt-5', 'gpt-4o-mini'],
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  openai_compatible: ['llama3.1', 'qwen2.5', 'llava'],
};

const PRESETS = [
  { name: 'Ollama (lokal)', baseUrl: 'http://host.docker.internal:11434/v1', model: 'llama3.1' },
  { name: 'LM Studio', baseUrl: 'http://host.docker.internal:1234/v1', model: 'local-model' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini' },
  { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
];

type LlmDraft = AdminSettings['llm'] & { apiKey: string };

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.admin.login(password);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container admin-login">
      <Mascot pose="protect" size={160} say="Halt! Dieser Bereich ist nur für Betreiber." bubbleSide="right" />
      <form className="card card-pad login-card" onSubmit={submit}>
        <h1>
          <Lock size={24} aria-hidden="true" /> Betreiber-Bereich
        </h1>
        <p className="muted">
          Melde dich mit dem Admin-Passwort an. Es wird über <code>ADMIN_PASSWORD</code> festgelegt oder beim ersten Start erzeugt (siehe Server-Log bzw. <code>data/admin-password.txt</code>).
        </p>
        <label className="field">
          <span className="field-label">Passwort</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && (
          <div className="notice notice-error">
            <CircleAlert size={18} aria-hidden="true" /> {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !password}>
          {busy ? <span className="spinner" /> : <KeyRound size={18} />} Anmelden
        </button>
      </form>
    </div>
  );
}

function Locked({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="locked" title="Per Umgebungsvariable festgelegt">
      <Lock size={12} /> per ENV gesetzt
    </span>
  );
}

function LlmTab({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const [draft, setDraft] = useState<LlmDraft>({ ...settings.llm, apiKey: '' });
  const [busy, setBusy] = useState<'save' | 'test' | 'models' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const locked = useMemo(() => new Set(settings.locked), [settings.locked]);
  const isLocked = (k: string) => locked.has(`llm.${k}`);
  const set = <K extends keyof LlmDraft>(k: K, v: LlmDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const patch = () => {
    const out: Record<string, unknown> = {};
    const fields: (keyof LlmDraft)[] = ['provider', 'model', 'baseUrl', 'temperature', 'maxTokens', 'vision', 'effort', 'timeoutSeconds'];
    for (const f of fields) if (!isLocked(f)) out[f] = draft[f];
    if (draft.apiKey && !isLocked('apiKey')) out.apiKey = draft.apiKey;
    return out;
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      const next = await api.admin.save({ llm: patch() });
      onSaved(next);
      setDraft({ ...next.llm, apiKey: '' });
      setMessage({ ok: true, text: 'Gespeichert.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.' });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    setBusy('save');
    try {
      const next = await api.admin.save({ llm: { apiKey: '' } });
      onSaved(next);
      setDraft({ ...next.llm, apiKey: '' });
      setMessage({ ok: true, text: 'API-Key entfernt.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Fehler.' });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    try {
      const r = await api.admin.test(patch());
      setMessage({ ok: r.ok, text: r.ok ? `Verbindung steht (${r.model}, ${(r.latencyMs / 1000).toFixed(1)} s): „${r.message}“` : r.message });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Test fehlgeschlagen.' });
    } finally {
      setBusy(null);
    }
  };

  const loadModels = async () => {
    setBusy('models');
    try {
      const r = await api.admin.models(patch());
      setModels(r.models);
      setMessage({ ok: true, text: `${r.models.length} Modelle gefunden.` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Modelle konnten nicht geladen werden.' });
    } finally {
      setBusy(null);
    }
  };

  const suggestions = [...new Set([...MODEL_SUGGESTIONS[draft.provider], ...models])];
  const needsKey = draft.provider === 'openai' || draft.provider === 'anthropic';
  const ready = draft.provider !== 'none' && (draft.provider === 'openai_compatible' ? Boolean(draft.baseUrl) : settings.llm.hasApiKey || Boolean(draft.apiKey));

  return (
    <div className="admin-panel">
      <div className="panel-head">
        <h2>KI-Anbieter</h2>
        <p className="muted">Ohne KI arbeitet {MASCOT_NAME} mit der eingebauten Mustererkennung. Mit KI werden Texte und Screenshots deutlich gründlicher und verständlicher bewertet.</p>
      </div>

      <div className="provider-grid" role="radiogroup" aria-label="Anbieter">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={draft.provider === p.id}
            className={`provider-card ${draft.provider === p.id ? 'is-active' : ''}`}
            onClick={() => !isLocked('provider') && setDraft((d) => ({ ...d, provider: p.id, model: p.id === d.provider ? d.model : (MODEL_SUGGESTIONS[p.id][0] ?? '') }))}
            disabled={isLocked('provider') && draft.provider !== p.id}
          >
            <strong>{p.name}</strong>
            <span>{p.text}</span>
          </button>
        ))}
      </div>
      <Locked show={isLocked('provider')} />

      {draft.provider === 'openai_compatible' && (
        <div className="presets">
          <span className="field-label">Schnellauswahl</span>
          <div className="chip-row">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className="chip" onClick={() => setDraft((d) => ({ ...d, baseUrl: p.baseUrl, model: p.model }))} disabled={isLocked('baseUrl')}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {draft.provider !== 'none' && (
        <div className="form-grid">
          <label className="field span-2">
            <span className="field-label">
              API-Key {!needsKey && <span className="muted">(optional bei lokalen Servern)</span>} <Locked show={isLocked('apiKey')} />
            </span>
            <div className="key-row">
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder={settings.llm.hasApiKey ? `Gespeichert: ${settings.llm.apiKeyHint} – leer lassen zum Behalten` : draft.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                value={draft.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
                disabled={isLocked('apiKey')}
              />
              {settings.llm.hasApiKey && !isLocked('apiKey') && (
                <button type="button" className="btn btn-sm btn-danger" onClick={removeKey} disabled={busy !== null}>
                  <Trash size={15} /> Entfernen
                </button>
              )}
            </div>
            <span className="field-hint">Wird verschlüsselt im Datenverzeichnis gespeichert und nie an den Browser zurückgegeben.</span>
          </label>

          <label className="field">
            <span className="field-label">
              Modell <Locked show={isLocked('model')} />
            </span>
            <div className="key-row">
              <input className="input" list="model-list" value={draft.model} onChange={(e) => set('model', e.target.value)} disabled={isLocked('model')} />
              <button type="button" className="btn btn-sm" onClick={loadModels} disabled={busy !== null || !ready} title="Verfügbare Modelle vom Anbieter laden">
                {busy === 'models' ? <span className="spinner" /> : <RefreshCw size={15} />}
              </button>
            </div>
            <datalist id="model-list">
              {suggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field-label">
              Basis-URL {draft.provider !== 'openai_compatible' && <span className="muted">(optional, z. B. Proxy)</span>} <Locked show={isLocked('baseUrl')} />
            </span>
            <input
              className="input"
              placeholder={draft.provider === 'openai_compatible' ? 'http://host.docker.internal:11434/v1' : 'Standard des Anbieters'}
              value={draft.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value.trim())}
              disabled={isLocked('baseUrl')}
            />
          </label>

          <label className="field">
            <span className="field-label">
              Denktiefe <Locked show={isLocked('effort')} />
            </span>
            <select className="select" value={draft.effort} onChange={(e) => set('effort', e.target.value as LlmDraft['effort'])} disabled={isLocked('effort')}>
              <option value="low">Niedrig – schnell & günstig (empfohlen)</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch – gründlicher, langsamer</option>
            </select>
            <span className="field-hint">Für Claude und OpenAI-Reasoning-Modelle (gpt-5, o-Serie).</span>
          </label>

          <label className="field">
            <span className="field-label">
              Temperatur <Locked show={isLocked('temperature')} />
            </span>
            <input
              className="input"
              type="number"
              min={0}
              max={2}
              step={0.1}
              placeholder="Standard"
              value={draft.temperature ?? ''}
              onChange={(e) => set('temperature', e.target.value === '' ? null : Number(e.target.value))}
              disabled={isLocked('temperature')}
            />
            <span className="field-hint">Leer = Modell-Standard. Wird bei Claude und Reasoning-Modellen ignoriert.</span>
          </label>

          <label className="field">
            <span className="field-label">
              Max. Antwort-Tokens <Locked show={isLocked('maxTokens')} />
            </span>
            <input className="input" type="number" min={500} max={32000} step={100} value={draft.maxTokens} onChange={(e) => set('maxTokens', Number(e.target.value))} disabled={isLocked('maxTokens')} />
          </label>

          <label className="field">
            <span className="field-label">Zeitlimit (Sekunden)</span>
            <input className="input" type="number" min={10} max={600} value={draft.timeoutSeconds} onChange={(e) => set('timeoutSeconds', Number(e.target.value))} />
          </label>

          <label className="toggle span-2">
            <input type="checkbox" checked={draft.vision} onChange={(e) => set('vision', e.target.checked)} disabled={isLocked('vision')} />
            <span>
              Screenshots an die KI senden (Bildanalyse) <Locked show={isLocked('vision')} />
            </span>
          </label>
        </div>
      )}

      {message && (
        <div className={`notice ${message.ok ? 'notice-ok' : 'notice-error'}`}>
          {message.ok ? <CircleCheck size={18} /> : <CircleAlert size={18} />} <span>{message.text}</span>
        </div>
      )}

      <div className="panel-actions">
        {draft.provider !== 'none' && (
          <button type="button" className="btn" onClick={test} disabled={busy !== null || !ready}>
            {busy === 'test' ? <span className="spinner" /> : <Zap size={17} />} Verbindung testen
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === 'save' ? <span className="spinner" /> : <CircleCheck size={17} />} Speichern
        </button>
      </div>
    </div>
  );
}

function PromptTab({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const [value, setValue] = useState(settings.prompt.systemOverride ?? settings.prompt.defaultPrompt);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const isDefault = value.trim() === settings.prompt.defaultPrompt.trim();

  const save = async (override: string | null) => {
    try {
      const next = await api.admin.save({ prompt: { systemOverride: override } });
      onSaved(next);
      setValue(next.prompt.systemOverride ?? next.prompt.defaultPrompt);
      setMessage({ ok: true, text: override ? 'Eigener System-Prompt gespeichert.' : 'Standard-Prompt aktiv.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.' });
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-head">
        <h2>System-Prompt</h2>
        <p className="muted">
          Diese Anweisung bekommt die KI vor jeder Prüfung. Der Standard liegt in <code>server/prompts/scam-check.system.md</code>. Wichtig: Die Antwort muss das JSON-Format mit allen Feldern behalten, sonst greift die Mustererkennung als Rückfall.
        </p>
        <span className={`badge ${settings.prompt.systemOverride ? 'badge-warn' : 'badge-ok'}`}>{settings.prompt.systemOverride ? 'Eigener Prompt aktiv' : 'Standard-Prompt aktiv'}</span>
      </div>
      <textarea className="textarea prompt-editor" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
      <span className="field-hint">{value.length.toLocaleString('de-DE')} Zeichen</span>
      {message && <div className={`notice ${message.ok ? 'notice-ok' : 'notice-error'}`}>{message.text}</div>}
      <div className="panel-actions">
        <button type="button" className="btn" onClick={() => save(null)} disabled={!settings.prompt.systemOverride && isDefault}>
          Standard wiederherstellen
        </button>
        <button type="button" className="btn btn-primary" onClick={() => save(isDefault ? null : value)}>
          <CircleCheck size={17} /> Speichern
        </button>
      </div>
    </div>
  );
}

function NewsTab({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const [feeds, setFeeds] = useState<FeedConfig[]>(settings.news.feeds);
  const [refreshMinutes, setRefreshMinutes] = useState(settings.news.refreshMinutes);
  const [aiExplain, setAiExplain] = useState(settings.news.aiExplain);
  const [status, setStatus] = useState<SourceStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newFeed, setNewFeed] = useState<FeedConfig>({ id: '', name: '', url: '', lang: 'de', kind: 'tech', enabled: true });

  useEffect(() => {
    api.admin
      .sources()
      .then((r) => setStatus(r.sources))
      .catch(() => {});
  }, []);

  const statusOf = (id: string) => status.find((s) => s.id === id);
  const update = (i: number, patch: Partial<FeedConfig>) => setFeeds((f) => f.map((feed, idx) => (idx === i ? { ...feed, ...patch } : feed)));

  const addFeed = () => {
    const id = (newFeed.id || newFeed.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id || !newFeed.url) return setMessage({ ok: false, text: 'Bitte Name und URL angeben.' });
    if (feeds.some((f) => f.id === id)) return setMessage({ ok: false, text: 'Diese Quelle gibt es schon.' });
    setFeeds((f) => [...f, { ...newFeed, id }]);
    setNewFeed({ id: '', name: '', url: '', lang: 'de', kind: 'tech', enabled: true });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await api.admin.save({ news: { feeds, refreshMinutes, aiExplain } });
      onSaved(next);
      setMessage({ ok: true, text: 'Gespeichert. Geänderte Quellen werden im Hintergrund neu geladen.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await api.admin.refreshNews();
      setStatus(r.sources);
      const ok = r.sources.filter((s) => s.ok).length;
      setMessage({ ok: true, text: `${ok} von ${r.sources.filter((s) => s.enabled).length} Quellen erfolgreich geladen.` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Aktualisierung fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-head">
        <h2>News-Quellen</h2>
        <p className="muted">RSS- oder Atom-Feeds, die im News-Tab erscheinen. Bilder werden über den Server geladen, damit Besucher keine Verbindung zu Drittanbietern aufbauen.</p>
      </div>

      <div className="feed-table" role="table">
        {feeds.map((f, i) => {
          const s = statusOf(f.id);
          return (
            <div key={f.id} className="feed-row" role="row">
              <label className="toggle" title="Aktiv">
                <input type="checkbox" checked={f.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
              </label>
              <div className="feed-main">
                <input className="input input-sm" value={f.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Name" />
                <input className="input input-sm mono" value={f.url} onChange={(e) => update(i, { url: e.target.value })} aria-label="Feed-URL" />
              </div>
              <select className="select input-sm" value={f.lang} onChange={(e) => update(i, { lang: e.target.value as FeedConfig['lang'] })} aria-label="Sprache">
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>
              <select className="select input-sm" value={f.kind} onChange={(e) => update(i, { kind: e.target.value as FeedConfig['kind'] })} aria-label="Art">
                <option value="consumer">Verbraucher</option>
                <option value="gov">Behörde</option>
                <option value="tech">IT-News</option>
              </select>
              <span className={`feed-status ${s?.ok === true ? 'is-ok' : s?.ok === false ? 'is-down' : ''}`} title={s?.lastError ?? undefined}>
                {s?.ok === true ? `${s.count} Meldungen` : s?.ok === false ? 'Fehler' : '–'}
                {s?.lastFetched && <small>{relativeTime(s.lastFetched)}</small>}
              </span>
              <button type="button" className="icon-btn" onClick={() => setFeeds((list) => list.filter((_, idx) => idx !== i))} aria-label={`${f.name} entfernen`}>
                <Trash size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="feed-add">
        <input className="input input-sm" placeholder="Name" value={newFeed.name} onChange={(e) => setNewFeed((n) => ({ ...n, name: e.target.value }))} />
        <input className="input input-sm mono" placeholder="https://…/feed.xml" value={newFeed.url} onChange={(e) => setNewFeed((n) => ({ ...n, url: e.target.value.trim() }))} />
        <select className="select input-sm" value={newFeed.lang} onChange={(e) => setNewFeed((n) => ({ ...n, lang: e.target.value as FeedConfig['lang'] }))}>
          <option value="de">DE</option>
          <option value="en">EN</option>
        </select>
        <select className="select input-sm" value={newFeed.kind} onChange={(e) => setNewFeed((n) => ({ ...n, kind: e.target.value as FeedConfig['kind'] }))}>
          <option value="consumer">Verbraucher</option>
          <option value="gov">Behörde</option>
          <option value="tech">IT-News</option>
        </select>
        <button type="button" className="btn btn-sm" onClick={addFeed}>
          <Plus size={15} /> Hinzufügen
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Aktualisierung alle … Minuten</span>
          <input className="input" type="number" min={5} max={1440} value={refreshMinutes} onChange={(e) => setRefreshMinutes(Number(e.target.value))} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={aiExplain} onChange={(e) => setAiExplain(e.target.checked)} />
          „Erklär’s mir einfach“ per KI anbieten
        </label>
      </div>

      {message && <div className={`notice ${message.ok ? 'notice-ok' : 'notice-error'}`}>{message.text}</div>}
      <div className="panel-actions">
        <button type="button" className="btn" onClick={refresh} disabled={busy}>
          <RefreshCw size={16} /> Jetzt abrufen
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          <CircleCheck size={17} /> Speichern
        </button>
      </div>
    </div>
  );
}

function LimitsTab({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const [checks, setChecks] = useState(settings.limits.checksPerHour);
  const [explain, setExplain] = useState(settings.limits.explainPerHour);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = settings.locked.includes('limits.checksPerHour');

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const save = async () => {
    try {
      const next = await api.admin.save({ limits: { ...(locked ? {} : { checksPerHour: checks }), explainPerHour: explain } });
      onSaved(next);
      setMessage({ ok: true, text: 'Gespeichert.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.' });
    }
  };

  const total = stats?.totalChecks ?? 0;
  return (
    <div className="admin-panel">
      <div className="panel-head">
        <h2>Limits &amp; Statistik</h2>
        <p className="muted">Limits schützen dein KI-Guthaben vor Missbrauch. Sie gelten pro IP-Adresse und Stunde. Hinter einem Reverse-Proxy bitte <code>TRUST_PROXY</code> setzen.</p>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">
            Prüfungen pro Stunde <Locked show={locked} />
          </span>
          <input className="input" type="number" min={1} max={10000} value={checks} onChange={(e) => setChecks(Number(e.target.value))} disabled={locked} />
        </label>
        <label className="field">
          <span className="field-label">KI-Erklärungen (News) pro Stunde</span>
          <input className="input" type="number" min={1} max={10000} value={explain} onChange={(e) => setExplain(Number(e.target.value))} />
        </label>
      </div>
      {message && <div className={`notice ${message.ok ? 'notice-ok' : 'notice-error'}`}>{message.text}</div>}
      <div className="panel-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          <CircleCheck size={17} /> Speichern
        </button>
      </div>

      {stats && (
        <div className="stats-block">
          <h3>Anonyme Statistik seit {new Date(stats.since).toLocaleDateString('de-DE')}</h3>
          <div className="stat-tiles">
            <div>
              <strong>{total.toLocaleString('de-DE')}</strong>
              <span>Prüfungen</span>
            </div>
            <div>
              <strong>{stats.aiChecks.toLocaleString('de-DE')}</strong>
              <span>davon mit KI</span>
            </div>
            <div>
              <strong>{stats.warned.toLocaleString('de-DE')}</strong>
              <span>Warnungen</span>
            </div>
          </div>
          <ul className="verdict-bars">
            {(Object.keys(VERDICT_STYLE) as (keyof typeof VERDICT_STYLE)[]).map((v) => {
              const n = stats.byVerdict[v] ?? 0;
              return (
                <li key={v} className={`verdict-${v}`}>
                  <span>{VERDICT_STYLE[v].label}</span>
                  <span className="bar">
                    <span style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                  </span>
                  <strong>{n}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { reload: reloadMeta } = useMeta();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [tab, setTab] = useState<Tab>('llm');

  const loadSettings = useCallback(() => {
    api.admin
      .settings()
      .then((s) => {
        setSettings(s);
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(loadSettings, [loadSettings]);

  const onSaved = (s: AdminSettings) => {
    setSettings(s);
    reloadMeta();
  };

  const logout = async () => {
    await api.admin.logout().catch(() => {});
    setAuthed(false);
    setSettings(null);
  };

  if (authed === null) {
    return (
      <div className="container admin-loading">
        <span className="spinner" />
      </div>
    );
  }
  if (!authed || !settings) return <Login onDone={loadSettings} />;

  const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: 'llm', label: 'KI-Anbieter', icon: Bot },
    { id: 'prompt', label: 'System-Prompt', icon: ScrollText },
    { id: 'news', label: 'News-Quellen', icon: Rss },
    { id: 'limits', label: 'Limits & Statistik', icon: ChartBar },
  ];

  return (
    <div className="container admin-page">
      <header className="page-head admin-head">
        <div>
          <span className="eyebrow">Betreiber-Bereich</span>
          <h1>Einstellungen</h1>
          <p className="muted">
            <Server size={15} aria-hidden="true" /> Status:{' '}
            {settings.llm.provider === 'none' ? 'Nur Mustererkennung' : `${PROVIDERS.find((p) => p.id === settings.llm.provider)?.name} · ${settings.llm.model}`}
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={logout}>
          <LogOut size={16} /> Abmelden
        </button>
      </header>

      <div className="admin-layout">
        <nav className="admin-tabs" aria-label="Bereiche">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`admin-tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={18} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        <section className="card card-pad admin-content">
          {tab === 'llm' && <LlmTab settings={settings} onSaved={onSaved} />}
          {tab === 'prompt' && <PromptTab settings={settings} onSaved={onSaved} />}
          {tab === 'news' && <NewsTab settings={settings} onSaved={onSaved} />}
          {tab === 'limits' && <LimitsTab settings={settings} onSaved={onSaved} />}
        </section>
      </div>
    </div>
  );
}

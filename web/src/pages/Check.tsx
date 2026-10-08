import { CircleAlert, ClipboardPaste, Clock, ImagePlus, Lock, ScanSearch, Trash, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { Mascot, MASCOT_NAME } from '../components/Mascot';
import { ResultView } from '../components/ResultView';
import { useHistory, useMeta } from '../hooks/useMeta';
import { api, ApiError } from '../lib/api';
import type { AnalysisResult, Platform } from '../lib/types';
import { PLATFORM_OPTIONS, relativeTime, VERDICT_STYLE } from '../lib/verdict';
import './check.css';

interface Upload {
  file: File;
  url: string;
}

type Phase = 'form' | 'running' | 'result';

/** Live hint from Checky while the user fills in the form. */
function liveTip(text: string, uploads: number, platform: Platform, visionReady: boolean): string {
  const t = text.trim();
  if (uploads && !visionReady) return 'Screenshots kann ich gerade nicht lesen – bitte kopiere den Text zusätzlich ins Feld.';
  if (!t && uploads) return 'Super, ich schaue mir den Screenshot an. Ein paar Worte dazu helfen mir zusätzlich.';
  if (!t) return `Hi, ich bin ${MASCOT_NAME}! Füge die verdächtige Nachricht oder Anzeige ein – ich sage dir, was ich davon halte.`;
  if (/https?:\/\/|www\.|\.[a-z]{2,6}\//i.test(t)) return 'Ich sehe einen Link. Keine Sorge: Ich öffne ihn nicht, ich untersuche nur, wohin er führt.';
  if (/\b(tan|pin|passwort|code)\b/i.test(t)) return 'Es geht um Codes oder Passwörter? Gib die niemals weiter, bevor wir das geprüft haben!';
  if (t.length < 40) return 'Je mehr Text du einfügst, desto genauer kann ich prüfen – gern die ganze Nachricht.';
  if (platform === 'unknown') return 'Verrätst du mir noch, wo du das gesehen hast? Das hilft mir bei der Einordnung.';
  return 'Alles bereit! Wenn du magst, schreib noch kurz dazu, was dich stutzig macht.';
}

export function CheckPage() {
  const { meta, reload: reloadMeta } = useMeta();
  const location = useLocation();
  const history = useHistory();
  const [text, setText] = useState(() => (location.state as { text?: string } | null)?.text ?? '');
  const [context, setContext] = useState('');
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [phase, setPhase] = useState<Phase>('form');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [pending, setPending] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const maxImages = meta?.limits.maxImages ?? 3;
  const maxMB = meta?.limits.maxImageMB ?? 6;
  const maxChars = meta?.limits.maxTextChars ?? 12000;
  const visionReady = Boolean(meta?.ai.ready && meta.ai.vision);
  const tip = useMemo(() => liveTip(text, uploads.length, platform, visionReady), [text, uploads.length, platform, visionReady]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type));
      if (!list.length) return setError('Bitte nur Bilder (PNG, JPG, WebP oder GIF) hochladen.');
      const tooBig = list.find((f) => f.size > maxMB * 1024 * 1024);
      if (tooBig) return setError(`„${tooBig.name}“ ist größer als ${maxMB} MB.`);
      setUploads((prev) => {
        const room = maxImages - prev.length;
        if (room <= 0) {
          setError(`Maximal ${maxImages} Bilder pro Prüfung.`);
          return prev;
        }
        return [...prev, ...list.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))];
      });
    },
    [maxImages, maxMB],
  );

  // Paste screenshots directly with Ctrl/Cmd+V.
  useEffect(() => {
    if (phase !== 'form') return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [phase, addFiles]);

  useEffect(() => () => uploads.forEach((u) => URL.revokeObjectURL(u.url)), []);

  const removeUpload = (url: string) => {
    URL.revokeObjectURL(url);
    setUploads((prev) => prev.filter((u) => u.url !== url));
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText((t) => (t ? `${t}\n${clip}` : clip));
    } catch {
      setError('Einfügen nicht erlaubt – nutze Strg+V bzw. ⌘+V im Textfeld.');
    }
  };

  const submit = async () => {
    setError(null);
    if (!text.trim() && !uploads.length) {
      setError('Bitte füge einen Text ein oder lade einen Screenshot hoch.');
      return;
    }
    setPending(null);
    setPhase('running');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const res = await api.check({ text, context, platform, images: uploads.map((u) => u.file) });
      setPending(res);
    } catch (err) {
      setPhase('form');
      setError(err instanceof ApiError ? err.message : 'Die Prüfung ist fehlgeschlagen. Bitte versuche es erneut.');
    }
  };

  const finish = useCallback(() => {
    if (!pending) return;
    setResult(pending);
    setPhase('result');
    history.add(pending, text || '(Screenshot)');
    reloadMeta();
  }, [pending, text]);

  const reset = () => {
    uploads.forEach((u) => URL.revokeObjectURL(u.url));
    setUploads([]);
    setText('');
    setContext('');
    setPlatform('unknown');
    setResult(null);
    setPhase('form');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="container check-page" ref={topRef}>
      {phase === 'form' && (
        <>
          <header className="page-head check-head">
            <span className="eyebrow">Nachricht prüfen</span>
            <h1>Was kommt dir komisch vor?</h1>
            <p className="lead">Füge eine Nachricht, Anzeige, E-Mail oder einen Beitrag ein – oder lade einen Screenshot hoch. {MASCOT_NAME} sagt dir in Sekunden, worauf du achten solltest.</p>
          </header>

          <div className="check-layout">
            <form
              className="card card-pad check-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset className="field platform-field">
                <legend className="field-label">Wo hast du das gesehen?</legend>
                <div className="chip-row">
                  {PLATFORM_OPTIONS.map((p) => (
                    <button key={p.id} type="button" className="chip" aria-pressed={platform === p.id} onClick={() => setPlatform(platform === p.id ? 'unknown' : (p.id as Platform))}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="field">
                <div className="field-row">
                  <label className="field-label" htmlFor="check-text">
                    Text, Nachricht oder Link
                  </label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={pasteFromClipboard}>
                    <ClipboardPaste size={16} /> Einfügen
                  </button>
                </div>
                <textarea
                  id="check-text"
                  className="textarea check-textarea"
                  placeholder={'z. B. „Ihr Paket konnte nicht zugestellt werden. Bitte bestätigen Sie Ihre Adresse unter …“'}
                  value={text}
                  maxLength={maxChars}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                />
                <span className="field-hint char-count">
                  {text.length.toLocaleString('de-DE')} / {maxChars.toLocaleString('de-DE')} Zeichen
                </span>
              </div>

              <div className="field">
                <span className="field-label">Screenshots (optional)</span>
                <div
                  className={`dropzone ${dragging ? 'is-dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  {uploads.map((u) => (
                    <div key={u.url} className="thumb">
                      <img src={u.url} alt={u.file.name} />
                      <button type="button" className="thumb-remove" onClick={() => removeUpload(u.url)} aria-label={`${u.file.name} entfernen`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {uploads.length < maxImages && (
                    <button type="button" className="drop-add" onClick={() => fileInput.current?.click()}>
                      <ImagePlus size={26} aria-hidden="true" />
                      <span>
                        <strong>Bild hinzufügen</strong>
                        <small>Ziehen, klicken oder mit Strg+V einfügen · bis {maxMB} MB</small>
                      </span>
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="check-context">
                  Was macht dich stutzig? <span className="muted">(optional)</span>
                </label>
                <input
                  id="check-context"
                  className="input"
                  placeholder="z. B. „Der Käufer will unbedingt per Kurier abholen lassen.“"
                  value={context}
                  maxLength={2000}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>

              {error && (
                <div className="notice notice-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="check-submit">
                <button type="submit" className="btn btn-primary btn-lg">
                  <ScanSearch size={20} aria-hidden="true" /> {MASCOT_NAME}, prüf das!
                </button>
                <span className="privacy-note">
                  <Lock size={14} aria-hidden="true" /> Wird nicht gespeichert
                </span>
              </div>
            </form>

            <aside className="check-aside">
              <div className="check-buddy">
                <Mascot pose={text.trim() || uploads.length ? 'curious' : 'friendly'} size={150} say={tip} bubbleSide="top" />
              </div>
              <div className="card card-pad engine-card">
                <h3>So prüft {MASCOT_NAME}</h3>
                <ul>
                  <li>
                    <strong>Mustererkennung</strong> mit über 30 bekannten Maschen aus dem DACH-Raum
                  </li>
                  <li>
                    <strong>Link-Analyse</strong> erkennt gefälschte Domains, Verkürzer und Tippfehler-Adressen
                  </li>
                  <li>
                    <strong>KI-Bewertung</strong>{' '}
                    {meta?.ai.ready ? (
                      <span className="badge badge-ok">aktiv</span>
                    ) : (
                      <span className="badge">nicht aktiviert</span>
                    )}{' '}
                    wägt alle Hinweise ab und erklärt sie verständlich
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          {history.entries.length > 0 && (
            <section className="history">
              <div className="history-head">
                <h2>
                  <Clock size={22} aria-hidden="true" /> Deine letzten Prüfungen
                </h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={history.clear}>
                  <Trash size={16} /> Verlauf löschen
                </button>
              </div>
              <p className="muted small">Nur auf diesem Gerät gespeichert.</p>
              <ul className="history-list">
                {history.entries.map((h) => (
                  <li key={h.id} className={`history-item verdict-${h.result.verdict}`}>
                    <button
                      type="button"
                      className="history-open"
                      onClick={() => {
                        setResult(h.result);
                        setPhase('result');
                      }}
                    >
                      <span className="history-score">{h.result.riskScore}</span>
                      <span className="history-text">
                        <strong>{VERDICT_STYLE[h.result.verdict].label}</strong>
                        <span>{h.excerpt}</span>
                      </span>
                      <span className="history-time">{relativeTime(h.createdAt)}</span>
                    </button>
                    <button type="button" className="icon-btn" onClick={() => history.remove(h.id)} aria-label="Eintrag entfernen">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {phase === 'running' && (
        <div className="check-running">
          <AnalysisProgress ai={Boolean(meta?.ai.ready)} hasImages={uploads.length > 0} done={pending !== null} onComplete={finish} />
        </div>
      )}

      {phase === 'result' && result && (
        <div className="check-result">
          <ResultView result={result} onReset={reset} />
        </div>
      )}
    </div>
  );
}

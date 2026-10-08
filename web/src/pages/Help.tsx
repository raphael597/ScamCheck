import { Banknote, Check, CreditCard, HeartHandshake, KeyRound, Monitor, Phone, ShieldAlert, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Mascot } from '../components/Mascot';
import './help.css';

const SITUATIONS = [
  {
    id: 'money',
    icon: Banknote,
    label: 'Geld überwiesen',
    steps: [
      'Ruf sofort deine Bank an (Nummer auf der Bankkarte oder Website) und bitte um Rückruf der Überweisung. Je schneller, desto besser.',
      'Bei Lastschrift: Du kannst sie meist bis zu 8 Wochen zurückbuchen lassen.',
      'Bei Kreditkarte oder PayPal: Rückbuchung bzw. Käuferschutz beantragen.',
      'Erstatte Anzeige bei der Polizei – online über die Onlinewache deines Bundeslandes oder auf der Wache.',
      'Sichere alle Beweise: Screenshots, Chatverläufe, Profil-Links, Zahlungsbelege.',
    ],
  },
  {
    id: 'card',
    icon: CreditCard,
    label: 'Karten- oder Bankdaten eingegeben',
    steps: [
      'Lass Karte und Online-Banking sofort sperren: Sperr-Notruf 116 116 (aus dem Ausland +49 116 116).',
      'Informiere deine Bank und prüfe die letzten Umsätze.',
      'Widersprich unbekannten Abbuchungen.',
      'Erstatte Anzeige bei der Polizei.',
    ],
  },
  {
    id: 'password',
    icon: KeyRound,
    label: 'Passwort oder Code verraten',
    steps: [
      'Ändere das Passwort sofort – und überall, wo du dasselbe Passwort nutzt.',
      'Melde dich in den Kontoeinstellungen von allen Geräten ab.',
      'Aktiviere die Zwei-Faktor-Anmeldung.',
      'Wurde dein Konto übernommen? Nutze die Wiederherstellungsfunktion des Anbieters und warne deine Kontakte.',
    ],
  },
  {
    id: 'remote',
    icon: Monitor,
    label: 'Fernzugriff erlaubt',
    steps: [
      'Trenne das Gerät sofort vom Internet (WLAN aus, Kabel ziehen).',
      'Deinstalliere die Fernwartungs-Software (AnyDesk, TeamViewer o. Ä.).',
      'Ändere von einem anderen, sicheren Gerät aus deine wichtigsten Passwörter, vor allem fürs Online-Banking.',
      'Informiere deine Bank und lass das Gerät von einer Fachperson prüfen.',
      'Erstatte Anzeige bei der Polizei.',
    ],
  },
  {
    id: 'identity',
    icon: UserRound,
    label: 'Ausweis geschickt / Video-Ident gemacht',
    steps: [
      'Erstatte Anzeige bei der Polizei – das schützt dich, falls Konten oder Verträge auf deinen Namen auftauchen.',
      'Informiere deine Bank.',
      'Hol dir eine kostenlose Selbstauskunft bei der SCHUFA, um neue Konten oder Verträge zu entdecken.',
      'Bei Verdacht auf Missbrauch: Ausweis beim Bürgeramt als missbraucht melden.',
    ],
  },
  {
    id: 'extortion',
    icon: ShieldAlert,
    label: 'Ich werde erpresst',
    steps: [
      'Zahle nicht und antworte nicht – Zahlungen führen meist zu weiteren Forderungen.',
      'Sichere die Nachrichten als Beweis.',
      'Blockiere den Kontakt und melde ihn bei der Plattform.',
      'Erstatte Anzeige bei der Polizei. Du hast nichts falsch gemacht.',
      'Hol dir Unterstützung – zum Beispiel beim WEISSEN RING oder der TelefonSeelsorge.',
    ],
  },
];

const CONTACTS = [
  {
    country: 'Deutschland',
    items: [
      { name: 'Sperr-Notruf', value: '116 116', note: 'Karten & Online-Banking sperren, rund um die Uhr' },
      { name: 'Polizei-Notruf', value: '110', note: 'Bei akuter Gefahr oder laufendem Betrug' },
      { name: 'WEISSER RING Opfer-Telefon', value: '116 006', note: 'Kostenlose Hilfe für Kriminalitätsopfer' },
      { name: 'TelefonSeelsorge', value: '0800 111 0 111', note: 'Wenn dich die Situation belastet – anonym' },
      { name: 'Verbraucherzentrale', value: 'verbraucherzentrale.de', note: 'Beratung, Phishing-Radar, Fakeshop-Finder' },
      { name: 'BSI für Bürger', value: 'bsi.bund.de', note: 'Infos zu IT-Sicherheit' },
    ],
  },
  {
    country: 'Österreich',
    items: [
      { name: 'Polizei-Notruf', value: '133', note: 'Notfälle' },
      { name: 'Watchlist Internet', value: 'watchlist-internet.at', note: 'Aktuelle Warnungen vor Online-Betrug' },
      { name: 'Meldestelle Cybercrime', value: 'against-cybercrime@bmi.gv.at', note: 'Bundeskriminalamt' },
    ],
  },
  {
    country: 'Schweiz',
    items: [
      { name: 'Polizei-Notruf', value: '117', note: 'Notfälle' },
      { name: 'Bundesamt für Cybersicherheit', value: 'ncsc.admin.ch', note: 'Vorfälle melden & Warnungen' },
    ],
  },
];

export function HelpPage() {
  const [active, setActive] = useState(SITUATIONS[0]!.id);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const situation = SITUATIONS.find((s) => s.id === active)!;

  return (
    <div className="container help-page">
      <header className="page-head help-head">
        <div>
          <span className="eyebrow">Soforthilfe</span>
          <h1>Ich bin reingefallen – was jetzt?</h1>
          <p className="lead">
            Atme kurz durch. Das passiert vielen – auch sehr klugen und vorsichtigen Menschen. Betrüger sind Profis darin, Druck zu machen. Jetzt zählt nur: Schaden begrenzen, Schritt für Schritt.
          </p>
        </div>
        <Mascot pose="friendly" size={170} say="Ich bin bei dir. Wir gehen das gemeinsam durch." bubbleSide="left" />
      </header>

      <section className="emergency-strip">
        <a href="tel:116116" className="emergency-call">
          <Phone size={22} aria-hidden="true" />
          <span>
            <strong>116 116</strong>
            <small>Karten &amp; Konto sperren</small>
          </span>
        </a>
        <a href="tel:110" className="emergency-call is-police">
          <Phone size={22} aria-hidden="true" />
          <span>
            <strong>110</strong>
            <small>Polizei (DE)</small>
          </span>
        </a>
        <a href="tel:116006" className="emergency-call is-support">
          <HeartHandshake size={22} aria-hidden="true" />
          <span>
            <strong>116 006</strong>
            <small>Opfer-Telefon</small>
          </span>
        </a>
      </section>

      <section className="card card-pad situations">
        <h2>Was ist passiert?</h2>
        <div className="situation-tabs" role="tablist">
          {SITUATIONS.map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" role="tab" aria-selected={active === id} className={`situation-tab ${active === id ? 'is-active' : ''}`} onClick={() => setActive(id)}>
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <ol className="help-steps" role="tabpanel" key={situation.id}>
          {situation.steps.map((step, i) => {
            const key = `${situation.id}-${i}`;
            return (
              <li key={key} style={{ '--i': i } as React.CSSProperties}>
                <button type="button" className={`step ${done[key] ? 'is-done' : ''}`} onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))} aria-pressed={Boolean(done[key])}>
                  <span className="step-check">{done[key] ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span>{step}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="muted small">Tipp: Hake erledigte Schritte ab. Nichts davon wird gespeichert.</p>
      </section>

      <section className="contacts">
        <h2>Hier bekommst du Hilfe</h2>
        <div className="contact-grid">
          {CONTACTS.map((group) => (
            <div key={group.country} className="card card-pad contact-group">
              <h3>{group.country}</h3>
              <ul>
                {group.items.map((c) => (
                  <li key={c.name}>
                    <span className="contact-name">{c.name}</span>
                    <strong className="contact-value">{c.value}</strong>
                    <span className="muted small">{c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

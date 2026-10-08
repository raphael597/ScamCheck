import type { NewsItem } from './aggregator.js';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const SAMPLE_SOURCE = { id: 'scamcheck-beispiel', name: 'ScamCheck (Beispielmeldung)', lang: 'de' as const, kind: 'consumer' as const };

/**
 * Shown only when no live feed could be loaded (e.g. offline installation).
 * Evergreen warnings about well-known scam patterns, clearly flagged as samples.
 */
export function sampleNews(): NewsItem[] {
  const items: Omit<NewsItem, 'id' | 'source' | 'image' | 'isSample'>[] = [
    {
      title: 'Gefälschte Paket-SMS: Betrüger verlangen „Nachgebühren“',
      summary:
        'Immer wieder kursieren SMS im Namen von DHL, DPD oder dem Zoll. Ein Link soll zu einer Zahlungsseite für kleine Beträge führen – dort werden Kartendaten abgegriffen. Paketdienste fordern keine Gebühren per SMS-Link.',
      link: '/ratgeber#phishing',
      publishedAt: hoursAgo(3),
      topics: ['phishing', 'scam', 'mobile'],
      isWarning: true,
    },
    {
      title: 'Kleinanzeigen: Vorsicht bei Kurier- und „Sicher bezahlen“-Links',
      summary:
        'Angebliche Käufer schicken Links zu nachgebauten Zahlungsseiten, auf denen Verkäufer ihre Kartendaten eingeben sollen. Wer Geld empfangen will, muss niemals Kartendaten oder Codes eingeben.',
      link: '/ratgeber#marketplace',
      publishedAt: hoursAgo(9),
      topics: ['scam', 'phishing'],
      isWarning: true,
    },
    {
      title: 'Falsche Bankmitarbeiter am Telefon: pushTAN niemals freigeben',
      summary:
        'Betrüger rufen mit gefälschter Rufnummer an, geben sich als Sicherheitsabteilung der Bank aus und bitten, eine Freigabe in der Banking-App zu bestätigen. Echte Bankmitarbeitende verlangen das nie.',
      link: '/ratgeber#impersonation',
      publishedAt: hoursAgo(20),
      topics: ['scam', 'phishing'],
      isWarning: true,
    },
    {
      title: 'Schockanrufe mit geklonter Stimme: Was hinter der KI-Masche steckt',
      summary:
        'Mit wenigen Sekunden Audiomaterial lassen sich Stimmen nachahmen. Vereinbare mit deiner Familie ein Codewort und ruf im Zweifel unter der bekannten Nummer zurück.',
      link: '/ratgeber#family_emergency',
      publishedAt: hoursAgo(30),
      topics: ['scam', 'ai'],
      isWarning: true,
    },
    {
      title: 'Fake-Shops vor Rabatt-Tagen: So erkennst du sie',
      summary:
        'Extrem günstige Markenware, nur Vorkasse und ein lückenhaftes Impressum sind typische Merkmale. Der Fakeshop-Finder der Verbraucherzentrale hilft bei der Prüfung.',
      link: '/ratgeber#fake_shop',
      publishedAt: hoursAgo(46),
      topics: ['scam'],
      isWarning: true,
    },
    {
      title: 'QR-Codes auf Parkautomaten: Quishing nimmt zu',
      summary:
        'Überklebte QR-Codes führen auf gefälschte Bezahlseiten. Prüfe vor der Zahlung die angezeigte Adresse und nutze lieber die offizielle App des Betreibers.',
      link: '/ratgeber#phishing',
      publishedAt: hoursAgo(60),
      topics: ['phishing', 'mobile'],
      isWarning: true,
    },
    {
      title: 'Sicherheitsupdates: Warum du Browser und Smartphone aktuell halten solltest',
      summary:
        'Viele Angriffe nutzen bekannte Sicherheitslücken, für die längst Updates existieren. Aktiviere automatische Updates für Betriebssystem, Browser und Apps.',
      link: '/ratgeber#basics',
      publishedAt: hoursAgo(80),
      topics: ['vulnerability'],
      isWarning: false,
    },
    {
      title: 'Datenleck? So prüfst du, ob deine E-Mail-Adresse betroffen ist',
      summary:
        'Dienste wie der HPI Identity Leak Checker zeigen, ob Zugangsdaten in Leaks aufgetaucht sind. Ändere betroffene Passwörter und nutze einen Passwort-Manager.',
      link: '/ratgeber#basics',
      publishedAt: hoursAgo(100),
      topics: ['breach', 'privacy'],
      isWarning: false,
    },
  ];
  return items.map((item, i) => ({ ...item, id: `sample-${i + 1}`, source: SAMPLE_SOURCE, image: null, isSample: true }));
}

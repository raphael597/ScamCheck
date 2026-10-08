export interface GuideEntry {
  id: string;
  title: string;
  short: string;
  how: string;
  signs: string[];
  protect: string[];
}

export const GOLDEN_RULES = [
  { title: 'Lass dich nicht hetzen', text: 'Zeitdruck ist das Werkzeug Nr. 1 der Betrüger. Seriöse Absender lassen dir Zeit.' },
  { title: 'Codes bleiben bei dir', text: 'PIN, TAN, SMS-Codes und Passwörter gibst du niemals weiter – an niemanden.' },
  { title: 'Selbst nachprüfen', text: 'Öffne die offizielle App oder tippe die Adresse selbst ein – nie über Links aus der Nachricht.' },
  { title: 'Bezahlen mit Schutz', text: 'Keine Gutscheinkarten, kein Krypto, keine Vorkasse an Unbekannte, kein „Freunde & Familie“.' },
  { title: 'Darüber reden', text: 'Frag eine Vertrauensperson oder prüf die Nachricht hier. Betrug lebt von Heimlichkeit.' },
];

export const GUIDE: GuideEntry[] = [
  {
    id: 'phishing',
    title: 'Phishing per Mail, SMS & QR-Code',
    short: 'Gefälschte Nachrichten von Bank, Paketdienst oder Online-Shop locken auf nachgebaute Seiten.',
    how: 'Du bekommst eine Nachricht, die echt aussieht: Paket wartet, Konto gesperrt, Sicherheits-Update nötig. Ein Link führt auf eine täuschend echte Kopie der Website. Alles, was du dort eingibst – Passwort, Kartendaten, TAN – landet bei den Betrügern.',
    signs: [
      'Link führt zu einer fremden Domain (z. B. dhl-zustellung.info statt dhl.de)',
      'Zeitdruck oder Drohung („innerhalb von 24 Stunden“, „Konto wird gesperrt“)',
      'Unpersönliche Anrede („Sehr geehrter Kunde“)',
      'Kleine Gebühr als Köder (1,99 € Nachporto oder Zoll)',
      'QR-Codes auf Briefen oder Parkautomaten, die zu Bezahlseiten führen',
    ],
    protect: [
      'Nie auf Links in unerwarteten Nachrichten klicken',
      'Sendungen nur in der offiziellen App oder mit eigener Sendungsnummer prüfen',
      'Zwei-Faktor-Anmeldung aktivieren',
      'Phishing an die Verbraucherzentrale weiterleiten',
    ],
  },
  {
    id: 'marketplace',
    title: 'Kleinanzeigen & Marktplätze',
    short: 'Falsche Käufer und Verkäufer auf Kleinanzeigen, Vinted, eBay & Co.',
    how: 'Als Verkäufer bekommst du sofort eine Anfrage: Der Käufer ist „unterwegs“, ein Kurier soll abholen, bezahlt wird über einen Link. Auf der Seite sollst du Kartendaten eingeben, um „das Geld zu empfangen“. Als Käufer triffst du auf Traumangebote, die nur gegen Vorkasse oder per „Freunde & Familie“ zu haben sind.',
    signs: [
      'Links zu „Sicher bezahlen“, Kurierdiensten oder Zahlungsseiten per Chat oder Mail',
      'Wunsch, auf WhatsApp oder E-Mail zu wechseln',
      'Käufer will ohne Fragen sofort den vollen Preis zahlen',
      'Verkäufer drängt auf PayPal „Freunde & Familie“ oder Überweisung',
    ],
    protect: [
      'Im Chat der Plattform bleiben',
      'Bezahlfunktionen nur direkt in der App nutzen',
      'Abholung mit Barzahlung vorschlagen',
      'Zum Geld-Empfangen nie Kartendaten eingeben',
    ],
  },
  {
    id: 'fake_shop',
    title: 'Fake-Shops',
    short: 'Professionell wirkende Online-Shops, die nie liefern.',
    how: 'Über Werbeanzeigen oder Suchmaschinen landest du in einem Shop mit unschlagbaren Preisen. Bezahlt wird per Vorkasse – und dann kommt nichts. Oft verschwinden die Shops nach wenigen Wochen und tauchen unter neuem Namen wieder auf.',
    signs: [
      'Markenware zu extrem niedrigen Preisen (-70 % und mehr)',
      'Am Ende nur Vorkasse oder Überweisung möglich',
      'Lückenhaftes oder fehlendes Impressum, keine Telefonnummer',
      'Neue, seltsame Domain (z. B. markenname-outlet-sale.shop)',
    ],
    protect: [
      'Fakeshop-Finder der Verbraucherzentrale nutzen',
      'Nach „Shopname + Erfahrungen“ suchen',
      'Mit Käuferschutz bezahlen (Kreditkarte, PayPal Waren & Dienstleistungen)',
    ],
  },
  {
    id: 'investment',
    title: 'Anlage- & Krypto-Betrug',
    short: 'Promi-Fakes, KI-Trading-Bots und „garantierte“ Renditen.',
    how: 'Gefälschte Nachrichtenartikel oder Deepfake-Videos zeigen Prominente, die angeblich mit einer Plattform reich wurden. Nach der Anmeldung rufen „Berater“ an, zeigen erfundene Gewinne und drängen zu immer höheren Einzahlungen. Auszahlungen klappen nie – stattdessen werden neue „Gebühren“ fällig.',
    signs: [
      'Garantierte oder extrem hohe Gewinne',
      'Prominente oder Politiker als angebliche Fürsprecher',
      'Druck, schnell einzuzahlen; Aufforderung, AnyDesk zu installieren',
      'Kontakt über WhatsApp- oder Telegram-Gruppen',
    ],
    protect: [
      'Anbieter in der BaFin-Unternehmensdatenbank prüfen',
      'Keine Fernwartungs-Software für Fremde installieren',
      'Vorsicht vor „Recovery“-Firmen nach einem Verlust',
    ],
  },
  {
    id: 'family_emergency',
    title: '„Hallo Mama“, Enkeltrick & Schockanrufe',
    short: 'Angebliche Angehörige in Not – per WhatsApp oder Telefon, inzwischen auch mit KI-Stimmen.',
    how: 'Eine unbekannte Nummer schreibt: „Hallo Mama, mein Handy ist kaputt, das ist meine neue Nummer.“ Kurz darauf geht es um eine dringende Rechnung. Am Telefon geben sich Betrüger als Kind, Enkel oder Polizei aus – mit Unfall, Kaution oder Notlage.',
    signs: [
      'Unbekannte Nummer, angeblich das neue Handy eines Angehörigen',
      'Schnelle Bitte um Geld, oft mit Ausrede, warum nicht selbst gezahlt wird',
      'Aufforderung, Geld oder Wertsachen an einen Boten zu übergeben',
    ],
    protect: [
      'Unter der alten, bekannten Nummer zurückrufen',
      'Ein Familien-Codewort vereinbaren',
      'Bei Anrufen auflegen und selbst die 110 wählen',
    ],
  },
  {
    id: 'job',
    title: 'Job-Betrug',
    short: 'Bewertungen schreiben, Pakete weiterleiten, App-Tests mit Video-Ident.',
    how: 'Ungefragt kommt ein Jobangebot per WhatsApp oder Telegram: viel Geld für wenig Arbeit. Erst gibt es kleine Auszahlungen, dann sollst du selbst einzahlen. Oder du wirst zum „Paketagenten“ und leitest Diebesgut weiter – oder eröffnest per Video-Ident unwissentlich Konten für Kriminelle.',
    signs: [
      'Hoher Verdienst ohne Erfahrung („300 € am Tag“)',
      'Kontakt nur über Messenger, keine echte Bewerbung',
      'Video-Ident für einen „Test“ oder „Auftrag“',
      'Du sollst Geld einzahlen, um Aufgaben freizuschalten',
    ],
    protect: [
      'Kein Video-Ident für Fremde',
      'Keine Pakete oder Gelder für Unbekannte weiterleiten',
      'Firma prüfen: Impressum, Handelsregister, echte Stellenanzeige',
    ],
  },
  {
    id: 'romance',
    title: 'Love-Scam',
    short: 'Große Gefühle im Netz – und plötzlich wird Geld gebraucht.',
    how: 'Über Dating-Apps oder soziale Netzwerke entsteht eine intensive Online-Beziehung. Die Person lebt angeblich im Ausland (Soldat, Ärztin, Ingenieur). Nach Wochen kommen Notfälle: Zollgebühren, Flugticket, Krankenhaus. Ein Treffen klappt nie.',
    signs: ['Sehr schnelle Liebesbekundungen', 'Videoanrufe werden immer wieder abgesagt', 'Geldbitten wegen Notfällen, Zoll oder Tickets'],
    protect: ['Bilder-Rückwärtssuche der Profilfotos', 'Niemals Geld an Menschen schicken, die man nie getroffen hat', 'Mit Vertrauenspersonen darüber sprechen'],
  },
  {
    id: 'impersonation',
    title: 'Falsche Polizisten, Bankmitarbeiter & Behörden',
    short: 'Betrüger mit Amtsautorität – oft mit gefälschter Rufnummer.',
    how: 'Am Telefon meldet sich die „Sicherheitsabteilung der Bank“, „Europol“ oder die „Polizei“. Es gebe verdächtige Abbuchungen oder Ermittlungen. Du sollst eine Freigabe in der Banking-App bestätigen, Geld „in Sicherheit bringen“ oder Wertsachen übergeben.',
    signs: [
      'Aufforderung, eine pushTAN oder Freigabe zu bestätigen',
      'Druck, Geheimhaltung, Drohung mit Strafen',
      'Bandansagen von „Europol“ oder „Interpol“',
    ],
    protect: ['Auflegen und die offizielle Nummer selbst wählen', 'Die Polizei ruft nie mit der 110 an', 'Freigaben nur für Aktionen, die du selbst gestartet hast'],
  },
  {
    id: 'tech_support',
    title: 'Fake-Support & falsche Virenwarnungen',
    short: 'Pop-ups und Anrufe von angeblichen Microsoft- oder Apple-Technikern.',
    how: 'Eine laute Warnung im Browser behauptet, dein Computer sei infiziert, und nennt eine Hotline. Oder jemand ruft „von Microsoft“ an. Ziel: Fernzugriff auf deinen Rechner und Geld für eine angebliche Reparatur.',
    signs: ['Pop-up mit Telefonnummer und Alarmton', 'Unaufgeforderter Anruf eines „Technikers“', 'Aufforderung, AnyDesk oder TeamViewer zu installieren'],
    protect: ['Browser schließen, notfalls über den Task-Manager', 'Nie Fernzugriff für Unbekannte erlauben', 'Microsoft und Apple rufen nie unaufgefordert an'],
  },
  {
    id: 'rental',
    title: 'Wohnungsbetrug',
    short: 'Traumwohnung zum Schnäppchenpreis – Vermieter leider im Ausland.',
    how: 'Die Wohnung ist günstig, zentral und schön. Der Vermieter ist gerade verreist, eine Besichtigung geht nicht – aber gegen Kaution schickt er die Schlüssel per Post. Oft wird auch eine Ausweiskopie verlangt, die für weitere Betrügereien genutzt wird.',
    signs: ['Miete deutlich unter Marktpreis', 'Keine Besichtigung möglich', 'Kaution vorab, „Treuhandservice“ von Airbnb o. Ä.', 'Ausweiskopie vor dem ersten Treffen'],
    protect: ['Nie ohne Besichtigung und Vertrag zahlen', 'Bilder-Rückwärtssuche der Fotos', 'Keine Ausweiskopien an Unbekannte'],
  },
  {
    id: 'subscription_trap',
    title: 'Abofallen & Gewinnspiele',
    short: '„Gratis“-Tests, die teuer werden, und Gewinne, für die du zahlen sollst.',
    how: 'Ein Gewinnspiel oder ein kostenloser Test verlangt Zahlungsdaten „nur für den Versand“. Im Kleingedruckten steckt ein teures Abo. Oder du hast angeblich gewonnen – musst aber vorher eine Gebühr zahlen.',
    signs: ['Gewinn ohne Teilnahme', 'Gebühr vor der Auszahlung', '„Nur Versandkosten“ bei Gratis-Produkten'],
    protect: ['Echte Gewinne kosten nie Geld', 'AGB vor der Eingabe von Zahlungsdaten lesen', '14-tägiges Widerrufsrecht nutzen'],
  },
  {
    id: 'sextortion',
    title: 'Sextortion & Erpressung',
    short: 'Massen-Mails mit angeblichen intimen Aufnahmen.',
    how: 'Eine E-Mail behauptet, dein Gerät sei gehackt und es gebe peinliche Aufnahmen von dir. Wenn du nicht in Bitcoin zahlst, würden sie an deine Kontakte gehen. Fast immer ist das ein Bluff, der millionenfach verschickt wird – manchmal mit einem alten Passwort aus einem Datenleck als „Beweis“.',
    signs: ['Drohung mit Veröffentlichung', 'Zahlungsforderung in Bitcoin', 'Altes Passwort als angeblicher Beweis'],
    protect: ['Nicht zahlen, nicht antworten', 'Betroffene Passwörter ändern', 'Anzeige erstatten – du hast nichts falsch gemacht'],
  },
];

export const BASICS = [
  'Updates für Smartphone, Computer und Apps automatisch installieren lassen',
  'Für jeden Dienst ein eigenes Passwort – am besten mit einem Passwort-Manager',
  'Zwei-Faktor-Anmeldung überall aktivieren, wo es geht',
  'Bei Datenlecks prüfen, ob die eigene E-Mail-Adresse betroffen ist (z. B. HPI Identity Leak Checker)',
  'Kontoauszüge und Kreditkartenumsätze regelmäßig ansehen',
];

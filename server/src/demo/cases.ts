import type { ModelVerdict, Platform } from '../types.js';

export interface DemoCase {
  id: string;
  title: string;
  teaser: string;
  platform: Platform;
  /** How the message is rendered in the demo mock-up. */
  channel: {
    kind: 'sms' | 'email' | 'whatsapp' | 'marketplace' | 'social' | 'shop' | 'job' | 'rental';
    sender: string;
    subject?: string;
    meta?: string;
    price?: string;
  };
  text: string;
  context: string;
  /** Pre-computed example result, used when no AI provider is configured. */
  sample: ModelVerdict;
}

const BANK_AFTERMATH = [
  'Hast du Daten eingegeben? Ruf sofort deine Bank an oder den Sperr-Notruf 116 116.',
  'Ändere dein Passwort für das betroffene Konto und prüfe deine letzten Umsätze.',
  'Erstatte Anzeige bei der Polizei (geht auch online über die Onlinewache).',
];

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'kleinanzeigen-sicher-bezahlen',
    title: 'Kleinanzeigen: „Sicher bezahlen“-Link',
    teaser: 'Ein Käufer will per Kurier abholen lassen und schickt einen Link zum „Geld empfangen“.',
    platform: 'marketplace',
    channel: { kind: 'marketplace', sender: 'Markus1987', meta: 'Anzeige: Kinderwagen Bugaboo Fox · 320 €', price: '320 €' },
    text:
      'Hallo, ist der Artikel noch da? Ich nehme ihn zum vollen Preis. Ich bin leider gerade beruflich unterwegs, deshalb habe ich die Zahlung über „Sicher bezahlen“ veranlasst, der DHL-Kurier holt das Paket bei dir ab. Bitte bestätige über diesen Link, um das Geld zu erhalten: https://kleinanzeigen.sicher-bezahlen-de.shop/receive/48213 – dort musst du nur kurz deine Kartendaten zur Verifizierung eingeben. Schreib mir gerne auch per WhatsApp: +44 7700 900123',
    context: 'Ich verkaufe einen Kinderwagen. Die Nachricht kam 5 Minuten nach dem Einstellen der Anzeige.',
    sample: {
      riskScore: 96,
      verdict: 'scam',
      confidence: 'high',
      category: 'marketplace',
      headline: 'Das ist Betrug – bitte gib auf dieser Seite keine Kartendaten ein.',
      summary:
        'Das ist die bekannte „Sicher bezahlen“-Masche: Der angebliche Käufer schickt einen Link auf eine gefälschte Zahlungsseite. Dort sollst du deine Kartendaten eingeben – angeblich, um Geld zu empfangen. In Wahrheit buchen die Betrüger damit Geld von deinem Konto ab.',
      redFlags: [
        {
          title: 'Kartendaten zum „Geld empfangen“',
          detail: 'Um Geld zu bekommen, musst du niemals Kartendaten oder Codes eingeben. Das ist das eindeutigste Zeichen dieser Masche.',
          evidence: 'dort musst du nur kurz deine Kartendaten zur Verifizierung eingeben',
          severity: 'high',
        },
        {
          title: 'Gefälschte Kleinanzeigen-Domain',
          detail: 'Der Link gehört nicht zu kleinanzeigen.de, sondern zu „sicher-bezahlen-de.shop“ – „kleinanzeigen“ steht nur vorne als Tarnung.',
          evidence: 'https://kleinanzeigen.sicher-bezahlen-de.shop/receive/48213',
          severity: 'high',
        },
        {
          title: 'Käufer „unterwegs“, Kurier holt ab',
          detail: 'Die Ausrede, nicht persönlich kommen zu können, ist typisch. So wird eine Barzahlung bei Abholung umgangen.',
          evidence: 'Ich bin leider gerade beruflich unterwegs … der DHL-Kurier holt das Paket bei dir ab',
          severity: 'medium',
        },
        {
          title: 'Wechsel zu WhatsApp mit ausländischer Nummer',
          detail: 'Betrüger wollen raus aus dem Plattform-Chat, weil sie dort leichter gesperrt werden.',
          evidence: 'Schreib mir gerne auch per WhatsApp: +44 7700 900123',
          severity: 'medium',
        },
        {
          title: 'Keine Frage zum Artikel, sofort voller Preis',
          detail: 'Echte Käufer stellen Fragen oder handeln. Sofortiges Interesse ohne Nachfrage ist auffällig.',
          evidence: 'Ich nehme ihn zum vollen Preis.',
          severity: 'low',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Klicke nicht auf den Link und gib keine Karten- oder Bankdaten ein.',
        'Antworte im Plattform-Chat: „Nur Abholung mit Barzahlung.“ – oder antworte gar nicht.',
        'Melde das Profil über die Meldefunktion von Kleinanzeigen.',
        'Nutze „Sicher bezahlen“ nur direkt in der Kleinanzeigen-App, nie über zugeschickte Links.',
      ],
      ifAlreadyInteracted: [
        'Kartendaten eingegeben? Lass die Karte sofort über 116 116 sperren.',
        'Prüfe deine Kontoumsätze und widersprich unbekannten Abbuchungen bei deiner Bank.',
        'Erstatte Anzeige bei der Polizei und sichere Screenshots vom Chat.',
      ],
      questionsToVerify: ['Würde der Käufer auch persönlich vorbeikommen und bar bezahlen?'],
      extractedText: '',
    },
  },
  {
    id: 'paket-sms',
    title: 'SMS: Paket nicht zugestellt',
    teaser: 'Angebliche DHL-Nachricht mit Nachgebühr und Link.',
    platform: 'sms',
    channel: { kind: 'sms', sender: '+49 1521 7783410', meta: 'Heute, 09:14' },
    text:
      'DHL: Ihr Paket konnte nicht zugestellt werden, da die Adresse unvollständig ist. Bitte bestätigen Sie Ihre Lieferadresse innerhalb von 24 Stunden und begleichen Sie die Nachgebühr von 1,99 €: https://dhl-zustellung.paket-hilfe.info/de',
    context: '',
    sample: {
      riskScore: 93,
      verdict: 'scam',
      confidence: 'high',
      category: 'phishing',
      headline: 'Das ist eine Phishing-SMS – bitte nicht auf den Link tippen.',
      summary:
        'Die SMS gibt sich als DHL aus, führt aber auf eine fremde Website. Die kleine „Nachgebühr“ ist ein Köder: Auf der Seite sollen Kreditkarten- oder Bankdaten eingegeben werden, die dann missbraucht werden.',
      redFlags: [
        {
          title: 'Link führt nicht zu DHL',
          detail: 'Die echte Adresse wäre dhl.de. Diese Domain heißt „paket-hilfe.info“ – „dhl-zustellung“ ist nur ein Tarnname davor.',
          evidence: 'https://dhl-zustellung.paket-hilfe.info/de',
          severity: 'high',
        },
        {
          title: 'Kleine Gebühr als Köder',
          detail: 'DHL verlangt keine Nachgebühren per SMS-Link. Der kleine Betrag soll dich unvorsichtig machen.',
          evidence: 'begleichen Sie die Nachgebühr von 1,99 €',
          severity: 'high',
        },
        {
          title: 'Zeitdruck',
          detail: 'Die Frist soll verhindern, dass du in Ruhe nachdenkst.',
          evidence: 'innerhalb von 24 Stunden',
          severity: 'medium',
        },
        {
          title: 'Absender ist eine Handynummer',
          detail: 'Unternehmen schicken SMS meist mit Namen als Absender, nicht von privaten Mobilfunknummern.',
          evidence: '+49 1521 7783410',
          severity: 'low',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Tippe nicht auf den Link und lösche die SMS.',
        'Erwartest du ein Paket? Prüfe den Status in der offiziellen DHL-App oder auf dhl.de mit deiner echten Sendungsnummer.',
        'Melde die SMS als Spam und leite sie bei Bedarf an die Bundesnetzagentur weiter.',
      ],
      ifAlreadyInteracted: [
        'Zahlungsdaten eingegeben? Lass die Karte sofort sperren (116 116).',
        'Hast du eine App installiert? Schalte das Handy in den Flugmodus und lass es prüfen.',
        'Erstatte Anzeige bei der Polizei.',
      ],
      questionsToVerify: ['Erwartest du gerade überhaupt ein Paket von DHL?'],
      extractedText: '',
    },
  },
  {
    id: 'hallo-mama',
    title: 'WhatsApp: „Hallo Mama, neue Nummer“',
    teaser: 'Das „Kind“ hat ein neues Handy und braucht schnell Geld.',
    platform: 'whatsapp',
    channel: { kind: 'whatsapp', sender: '+49 176 98234411', meta: 'Unbekannte Nummer' },
    text:
      'Hallo Mama, mein Handy ist ins Wasser gefallen 😩 das ist meine neue Nummer, kannst du die alte löschen. Ich hab ein Problem, muss heute noch eine Rechnung bezahlen, kann aber mit dem neuen Handy noch kein Online-Banking. Kannst du mir das schnell überweisen? Ich zahl dir’s morgen zurück ❤️',
    context: '',
    sample: {
      riskScore: 94,
      verdict: 'scam',
      confidence: 'high',
      category: 'family_emergency',
      headline: 'Vorsicht: Das ist die „Hallo Mama“-Masche.',
      summary:
        'Betrüger schreiben massenhaft „Hallo Mama“ oder „Hallo Papa“ von unbekannten Nummern. Sie behaupten, ein neues Handy zu haben, und bitten schnell um eine Überweisung. Dein Kind steckt sehr wahrscheinlich nicht dahinter.',
      redFlags: [
        {
          title: 'Unbekannte „neue Nummer“',
          detail: 'Die alte Nummer soll gelöscht werden – so kannst du nicht mehr einfach dort nachfragen.',
          evidence: 'das ist meine neue Nummer, kannst du die alte löschen',
          severity: 'high',
        },
        {
          title: 'Dringende Geldbitte',
          detail: 'Direkt nach der „neuen Nummer“ kommt eine Bitte um Geld, verbunden mit Zeitdruck.',
          evidence: 'muss heute noch eine Rechnung bezahlen … Kannst du mir das schnell überweisen?',
          severity: 'high',
        },
        {
          title: 'Keine persönlichen Details',
          detail: 'Kein Name, keine gemeinsamen Erinnerungen – die Nachricht passt auf jede Familie.',
          evidence: 'Hallo Mama',
          severity: 'medium',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Ruf dein Kind unter der alten, bekannten Nummer an – auch wenn es heißt, das Handy sei kaputt.',
        'Stell eine Frage, die nur dein Kind beantworten kann.',
        'Überweise nichts, bevor du mit deinem Kind gesprochen hast.',
        'Blockiere und melde die Nummer in WhatsApp.',
      ],
      ifAlreadyInteracted: [
        'Schon überwiesen? Ruf sofort deine Bank an – manchmal kann die Überweisung noch gestoppt werden.',
        'Erstatte Anzeige bei der Polizei und sichere den Chatverlauf.',
      ],
      questionsToVerify: ['Hast du dein Kind unter der alten Nummer erreicht?'],
      extractedText: '',
    },
  },
  {
    id: 'krypto-promi',
    title: 'Instagram-Anzeige: KI-Trading mit Promi',
    teaser: 'Ein TV-Star soll mit KI-Trading reich geworden sein.',
    platform: 'social',
    channel: { kind: 'social', sender: 'finanz.news.today', meta: 'Gesponsert' },
    text:
      '🔥 EXKLUSIV: Wie TV-Star Markus H. mit nur 250 € in 3 Monaten Millionär wurde! Die neue KI-Trading-Plattform „Quantum AI“ erzielt garantierte Gewinne von bis zu 3.000 € am Tag – völlig risikofrei. Banken wollen nicht, dass du das erfährst! Nur noch heute: Jetzt anmelden auf quantum-ai-official.top und finanzielle Freiheit sichern 🚀💰',
    context: '',
    sample: {
      riskScore: 97,
      verdict: 'scam',
      confidence: 'high',
      category: 'investment',
      headline: 'Das ist Anlagebetrug mit einer gefälschten Promi-Story.',
      summary:
        'Solche Anzeigen nutzen bekannte Gesichter ohne deren Wissen. Nach der Anmeldung rufen „Berater“ an, drängen zu Einzahlungen und zeigen erfundene Gewinne. Das Geld ist weg – Auszahlungen klappen nie.',
      redFlags: [
        {
          title: 'Garantierte Gewinne ohne Risiko',
          detail: 'Kein echtes Investment garantiert Gewinne. Hohe Rendite bedeutet immer hohes Risiko.',
          evidence: 'garantierte Gewinne von bis zu 3.000 € am Tag – völlig risikofrei',
          severity: 'high',
        },
        {
          title: 'Promi-Geschichte als Köder',
          detail: 'Prominente werben nicht für Trading-Plattformen. Diese Geschichten sind erfunden.',
          evidence: 'Wie TV-Star Markus H. mit nur 250 € in 3 Monaten Millionär wurde',
          severity: 'high',
        },
        {
          title: 'Bekannter Betrugsname „Quantum AI“',
          detail: 'Der Name taucht seit Jahren in Warnungen vor Krypto-Betrug auf.',
          evidence: 'KI-Trading-Plattform „Quantum AI“',
          severity: 'high',
        },
        {
          title: 'Verdächtige Domain-Endung',
          detail: '„.top“ wird überdurchschnittlich oft für Betrugsseiten genutzt.',
          evidence: 'quantum-ai-official.top',
          severity: 'medium',
        },
        {
          title: 'Verschwörung und Zeitdruck',
          detail: '„Banken wollen das verhindern“ und „nur noch heute“ sollen kritisches Nachdenken ausschalten.',
          evidence: 'Banken wollen nicht, dass du das erfährst! Nur noch heute',
          severity: 'medium',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Klicke die Anzeige nicht an und gib keine Telefonnummer ein.',
        'Melde die Anzeige bei Instagram als Betrug.',
        'Prüfe Anbieter immer in der Unternehmensdatenbank der BaFin.',
        'Installiere niemals AnyDesk oder TeamViewer für einen „Berater“.',
      ],
      ifAlreadyInteracted: [
        'Zahle nichts weiter – auch keine „Auszahlungsgebühr“.',
        'Ruf deine Bank an und lass Zahlungen prüfen oder zurückholen.',
        'Erstatte Anzeige bei der Polizei. Vorsicht vor „Recovery“-Firmen, die Hilfe gegen Gebühr versprechen.',
      ],
      questionsToVerify: ['Ist die Plattform in der BaFin-Unternehmensdatenbank zu finden?'],
      extractedText: '',
    },
  },
  {
    id: 'job-bewertungen',
    title: 'Jobangebot: Hotels bewerten im Homeoffice',
    teaser: '400 € am Tag für ein paar Bewertungen – ohne Erfahrung.',
    platform: 'job',
    channel: { kind: 'whatsapp', sender: 'Lisa | Digital Talents', meta: 'Unbekannte Nummer · +62 812 5521 0987' },
    text:
      'Hallo! Ich bin Lisa, Recruiterin bei Digital Talents GmbH. Wir haben Ihr Profil gesehen und suchen Mitarbeiter im Homeoffice. Ihre Aufgabe: Hotels und Produkte bewerten, nur 30–60 Minuten am Tag. Verdienst: 150 € bis 400 € pro Tag, keine Erfahrung nötig. Für die Einarbeitung kontaktieren Sie bitte unseren Mentor auf Telegram: @DT_Mentor_Anna. Antworten Sie mit JA, wenn Sie interessiert sind.',
    context: 'Ich habe mich nirgends beworben.',
    sample: {
      riskScore: 88,
      verdict: 'scam',
      confidence: 'high',
      category: 'job',
      headline: 'Das ist ein Job-Betrug („Task-Scam“).',
      summary:
        'Bei dieser Masche bekommst du anfangs kleine Beträge für „Aufgaben“ wie Bewertungen. Später sollst du selbst Geld einzahlen, um größere Aufgaben freizuschalten – dieses Geld siehst du nie wieder. Manchmal wird so auch Geldwäsche betrieben.',
      redFlags: [
        {
          title: 'Unrealistischer Verdienst',
          detail: 'Bis zu 400 € am Tag für wenige Minuten ohne Erfahrung – das gibt es bei echten Jobs nicht.',
          evidence: 'Verdienst: 150 € bis 400 € pro Tag, keine Erfahrung nötig',
          severity: 'high',
        },
        {
          title: 'Bekannte Masche „Bewertungen schreiben“',
          detail: 'Bewertungs- und Like-Jobs sind seit Jahren eine der häufigsten Job-Betrugsformen.',
          evidence: 'Hotels und Produkte bewerten',
          severity: 'high',
        },
        {
          title: 'Unaufgeforderte Nachricht, Wechsel zu Telegram',
          detail: 'Du hast dich nicht beworben. Der Wechsel zu Telegram erschwert die Nachverfolgung.',
          evidence: 'kontaktieren Sie bitte unseren Mentor auf Telegram',
          severity: 'medium',
        },
        {
          title: 'Ausländische Absendernummer',
          detail: 'Eine indonesische Nummer passt nicht zu einer angeblich deutschen GmbH.',
          evidence: '+62 812 5521 0987',
          severity: 'medium',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Antworte nicht und blockiere die Nummer.',
        'Zahle niemals Geld, um Aufgaben oder Provisionen „freizuschalten“.',
        'Mach keine Video-Ident-Verfahren für fremde Personen oder Firmen.',
      ],
      ifAlreadyInteracted: [
        'Schon eingezahlt? Stoppe alle weiteren Zahlungen und ruf deine Bank an.',
        'Ausweis geschickt oder Video-Ident gemacht? Informiere Bank und Polizei und hol dir eine SCHUFA-Selbstauskunft.',
      ],
      questionsToVerify: ['Gibt es die Firma mit Impressum, Handelsregistereintrag und echter Stellenanzeige?'],
      extractedText: '',
    },
  },
  {
    id: 'sparkasse-pushtan',
    title: 'E-Mail: pushTAN-Verfahren aktualisieren',
    teaser: 'Die „Sparkasse“ droht mit Einschränkung des Online-Bankings.',
    platform: 'email',
    channel: {
      kind: 'email',
      sender: 'Sparkasse <service@spk-kundenservice-update.com>',
      subject: 'Wichtig: Aktualisierung Ihres pushTAN-Verfahrens',
      meta: 'An: dich',
    },
    text:
      'Sehr geehrter Kunde,\n\naufgrund neuer gesetzlicher Vorgaben (PSD3) muss Ihr pushTAN-Verfahren bis zum 12.10. aktualisiert werden. Andernfalls wird Ihr Online-Banking-Zugang vorübergehend eingeschränkt.\n\nKlicken Sie hier, um die Aktualisierung abzuschließen:\nhttps://sparkasse-pushtan-aktualisierung.com/login\n\nMit freundlichen Grüßen\nIhre Sparkasse',
    context: '',
    sample: {
      riskScore: 95,
      verdict: 'scam',
      confidence: 'high',
      category: 'phishing',
      headline: 'Das ist eine Phishing-Mail – deine Sparkasse schickt solche Links nicht.',
      summary:
        'Die Mail will dich auf eine nachgebaute Login-Seite locken. Dort eingegebene Zugangsdaten und TANs nutzen Betrüger, um dein Konto leerzuräumen. Banken fordern nie per Mail-Link zur „Aktualisierung“ auf.',
      redFlags: [
        {
          title: 'Fremde Domain statt Sparkassen-Adresse',
          detail: 'Weder der Absender (spk-kundenservice-update.com) noch der Link gehören zu einer echten Sparkasse.',
          evidence: 'https://sparkasse-pushtan-aktualisierung.com/login',
          severity: 'high',
        },
        {
          title: 'Drohung mit Kontoeinschränkung',
          detail: 'Angst um den Kontozugang soll dich zum schnellen Klicken bringen.',
          evidence: 'Andernfalls wird Ihr Online-Banking-Zugang vorübergehend eingeschränkt.',
          severity: 'high',
        },
        {
          title: 'Erfundene „gesetzliche Vorgabe“',
          detail: 'Gesetze werden gern vorgeschoben, um der Nachricht Gewicht zu geben.',
          evidence: 'aufgrund neuer gesetzlicher Vorgaben (PSD3)',
          severity: 'medium',
        },
        {
          title: 'Unpersönliche Anrede',
          detail: 'Deine Bank kennt deinen Namen und würde dich damit ansprechen.',
          evidence: 'Sehr geehrter Kunde',
          severity: 'low',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Klicke nicht auf den Link.',
        'Öffne die Sparkassen-App oder tippe die Adresse deiner Sparkasse selbst ein, falls du unsicher bist.',
        'Leite die Mail an die Verbraucherzentrale (phishing@verbraucherzentrale.nrw) weiter und lösche sie.',
      ],
      ifAlreadyInteracted: BANK_AFTERMATH,
      questionsToVerify: ['Zeigt deine Banking-App selbst einen Hinweis zu einer Aktualisierung an?'],
      extractedText: '',
    },
  },
  {
    id: 'fake-shop',
    title: 'Online-Shop: Küchenmaschine für 249 €',
    teaser: '-83 % Rabatt, nur noch heute, nur Vorkasse.',
    platform: 'shop',
    channel: { kind: 'shop', sender: 'kuechen-outlet-deutschland.shop', meta: 'Produktseite', price: '249 € statt 1.499 €' },
    text:
      'Thermomix TM6 – Lagerräumung! Statt 1.499 € jetzt nur 249 € (-83 %). Nur noch 3 Stück verfügbar! Zahlung ausschließlich per Vorkasse/Banküberweisung, dafür 5 % Extra-Rabatt. Versand innerhalb von 24 h. www.kuechen-outlet-deutschland.shop',
    context: 'Den Shop habe ich über eine Facebook-Werbung gefunden.',
    sample: {
      riskScore: 84,
      verdict: 'likely_scam',
      confidence: 'high',
      category: 'fake_shop',
      headline: 'Sehr wahrscheinlich ein Fake-Shop – bitte nicht per Vorkasse zahlen.',
      summary:
        'Unrealistisch hoher Rabatt, künstliche Knappheit und nur Vorkasse sind die drei klassischen Merkmale von Fake-Shops. Nach der Überweisung kommt meist keine Ware, und das Geld ist kaum zurückzuholen.',
      redFlags: [
        {
          title: 'Unrealistischer Preis',
          detail: 'Ein Markengerät für 17 % des üblichen Preises – das kann kein seriöser Händler anbieten.',
          evidence: 'Statt 1.499 € jetzt nur 249 € (-83 %)',
          severity: 'high',
        },
        {
          title: 'Nur Vorkasse, Rabatt für Überweisung',
          detail: 'Bei Vorkasse hast du keinen Käuferschutz. Der Extra-Rabatt soll dich zu dieser Zahlungsart lenken.',
          evidence: 'Zahlung ausschließlich per Vorkasse/Banküberweisung, dafür 5 % Extra-Rabatt',
          severity: 'high',
        },
        {
          title: 'Künstliche Knappheit',
          detail: '„Nur noch 3 Stück“ soll Druck aufbauen.',
          evidence: 'Nur noch 3 Stück verfügbar!',
          severity: 'medium',
        },
        {
          title: 'Unbekannte .shop-Domain',
          detail: 'Fake-Shops nutzen oft neue Domains mit vertrauenserweckenden Wörtern wie „deutschland“ oder „outlet“.',
          evidence: 'www.kuechen-outlet-deutschland.shop',
          severity: 'medium',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Prüfe die Adresse im Fakeshop-Finder der Verbraucherzentrale.',
        'Schau ins Impressum und suche nach „Shopname + Erfahrungen“.',
        'Kaufe Markengeräte beim Hersteller oder bei bekannten Händlern.',
        'Zahle online nur mit Käuferschutz (z. B. Kreditkarte oder PayPal Waren & Dienstleistungen).',
      ],
      ifAlreadyInteracted: [
        'Schon überwiesen? Ruf sofort deine Bank an und bitte um Rückruf der Überweisung.',
        'Erstatte Anzeige bei der Polizei und melde den Shop der Verbraucherzentrale.',
      ],
      questionsToVerify: ['Steht im Impressum eine echte Firma mit Adresse in der EU?'],
      extractedText: '',
    },
  },
  {
    id: 'wohnung',
    title: 'Wohnungsanzeige: Vermieter im Ausland',
    teaser: 'Traumwohnung, Schlüssel per Post, Kaution vorab.',
    platform: 'rental',
    channel: { kind: 'rental', sender: 'Dr. Andreas Weber', meta: '3 Zimmer · 85 m² · München-Schwabing', price: '690 € warm' },
    text:
      'Schöne 3-Zimmer-Wohnung in München-Schwabing, 85 m², nur 690 € warm! Ich bin beruflich nach London gezogen und vermiete die Wohnung möbliert. Eine Besichtigung ist leider nicht möglich, aber ich schicke Ihnen die Schlüssel per Post, sobald die Kaution von 1.380 € über unseren Airbnb-Treuhandservice eingegangen ist. Bitte senden Sie mir vorab eine Ausweiskopie.',
    context: '',
    sample: {
      riskScore: 95,
      verdict: 'scam',
      confidence: 'high',
      category: 'rental',
      headline: 'Das ist Wohnungsbetrug – keine Kaution ohne Besichtigung!',
      summary:
        'Eine günstige Wohnung in Top-Lage, ein Vermieter im Ausland, keine Besichtigung und Schlüssel per Post: Das ist ein bekanntes Muster. Die Wohnung existiert so meist nicht, die Kaution ist verloren und die Ausweiskopie wird für weitere Betrügereien genutzt.',
      redFlags: [
        {
          title: 'Keine Besichtigung, Schlüssel per Post',
          detail: 'Echte Vermieter zeigen die Wohnung vor Vertragsabschluss.',
          evidence: 'Eine Besichtigung ist leider nicht möglich, aber ich schicke Ihnen die Schlüssel per Post',
          severity: 'high',
        },
        {
          title: 'Kaution vorab über „Treuhandservice“',
          detail: 'Airbnb bietet keinen Treuhandservice für Langzeitmieten an. Der Link dazu wäre eine Fake-Seite.',
          evidence: 'sobald die Kaution von 1.380 € über unseren Airbnb-Treuhandservice eingegangen ist',
          severity: 'high',
        },
        {
          title: 'Unrealistisch günstige Miete',
          detail: '690 € warm für 85 m² in Schwabing liegen weit unter dem Marktpreis.',
          evidence: '85 m², nur 690 € warm',
          severity: 'medium',
        },
        {
          title: 'Ausweiskopie vorab',
          detail: 'Mit deiner Ausweiskopie können Konten oder Verträge auf deinen Namen eröffnet werden.',
          evidence: 'Bitte senden Sie mir vorab eine Ausweiskopie.',
          severity: 'high',
        },
      ],
      greenFlags: [],
      recommendations: [
        'Zahle keine Kaution und schicke keine Ausweiskopie.',
        'Bestehe auf einer Besichtigung vor Ort mit Vertragsunterzeichnung.',
        'Mach eine Bilder-Rückwärtssuche der Wohnungsfotos.',
        'Melde die Anzeige beim Portal.',
      ],
      ifAlreadyInteracted: [
        'Schon bezahlt? Ruf sofort deine Bank an.',
        'Ausweiskopie verschickt? Erstatte Anzeige und behalte deine SCHUFA-Einträge im Blick.',
      ],
      questionsToVerify: ['Kannst du die Wohnung vor der Zahlung persönlich besichtigen?'],
      extractedText: '',
    },
  },
  {
    id: 'gewinnspiel-dm',
    title: 'Instagram-DM: Gewinnspiel-Gewinn',
    teaser: 'Ein Café-Profil meldet einen Gewinn – aber der Name sieht etwas anders aus.',
    platform: 'social',
    channel: { kind: 'social', sender: 'cafe.morgenrott_official', meta: 'Direktnachricht' },
    text:
      'Herzlichen Glückwunsch! 🎉 Du hast bei unserem Gewinnspiel gewonnen! Um deinen Preis zu erhalten, klicke bitte innerhalb von 12 Stunden auf den Link in unserer Bio und bestätige deine Daten. Danach wird dein Gewinn verschickt. – Team Café Morgenrot',
    context: 'Ich habe bei einem Gewinnspiel eines Cafés mitgemacht. Das echte Profil heißt cafe.morgenrot.',
    sample: {
      riskScore: 72,
      verdict: 'likely_scam',
      confidence: 'medium',
      category: 'lottery',
      headline: 'Wahrscheinlich ein Fake-Profil, das sich als das Café ausgibt.',
      summary:
        'Betrüger kopieren Profile, die gerade Gewinnspiele veranstalten, und schreiben Teilnehmende an. Der Link führt dann zu einer Seite, auf der Daten oder „Versandgebühren“ abgefragt werden. Das echte Café würde dich vom echten Profil aus kontaktieren.',
      redFlags: [
        {
          title: 'Abweichender Profilname',
          detail: 'Ein zusätzlicher Buchstabe und „_official“ sind typische Tricks von Kopier-Profilen.',
          evidence: 'cafe.morgenrott_official',
          severity: 'high',
        },
        {
          title: 'Daten über Link „bestätigen“',
          detail: 'Für einen Gewinn musst du keine Daten auf einer fremden Seite bestätigen.',
          evidence: 'klicke bitte innerhalb von 12 Stunden auf den Link in unserer Bio und bestätige deine Daten',
          severity: 'medium',
        },
        {
          title: 'Zeitdruck',
          detail: 'Die kurze Frist soll verhindern, dass du nachfragst.',
          evidence: 'innerhalb von 12 Stunden',
          severity: 'medium',
        },
      ],
      greenFlags: [{ title: 'Du hast wirklich teilgenommen', detail: 'Das macht einen echten Gewinn möglich – deshalb lohnt sich eine Nachfrage beim echten Profil.' }],
      recommendations: [
        'Frag beim echten Profil (cafe.morgenrot) direkt nach, ob du gewonnen hast.',
        'Klicke nicht auf den Link in der Bio des fremden Profils.',
        'Melde das Kopier-Profil bei Instagram als „gibt sich als jemand anderes aus“.',
      ],
      ifAlreadyInteracted: [
        'Daten oder Kartendaten eingegeben? Karte sperren lassen (116 116) und Passwörter ändern.',
        'Hast du dein Instagram-Passwort eingegeben? Sofort ändern und Zwei-Faktor-Anmeldung aktivieren.',
      ],
      questionsToVerify: ['Bestätigt das echte Café-Profil deinen Gewinn?'],
      extractedText: '',
    },
  },
  {
    id: 'echte-anfrage',
    title: 'Kleinanzeigen: Normale Kaufanfrage',
    teaser: 'Zum Vergleich: So sieht eine harmlose Nachricht aus.',
    platform: 'marketplace',
    channel: { kind: 'marketplace', sender: 'Jonas K.', meta: 'Anzeige: Damenfahrrad 28 Zoll · 180 €', price: '180 €' },
    text:
      'Hallo, ich interessiere mich für das Fahrrad. Wäre eine Abholung am Samstagvormittag möglich? Ich würde bar bezahlen und es mir vorher gerne kurz anschauen. Viele Grüße, Jonas',
    context: '',
    sample: {
      riskScore: 6,
      verdict: 'safe',
      confidence: 'high',
      category: 'none',
      headline: 'Das sieht nach einer ganz normalen Kaufanfrage aus.',
      summary:
        'Der Interessent möchte den Artikel ansehen, persönlich abholen und bar bezahlen. Es gibt keine Links, keine Datenabfrage und keinen Zeitdruck – genau so sehen seriöse Anfragen aus.',
      redFlags: [],
      greenFlags: [
        { title: 'Abholung mit Barzahlung', detail: 'Du bekommst das Geld direkt bei Übergabe – das ist für Verkäufer die sicherste Variante.' },
        { title: 'Möchte den Artikel ansehen', detail: 'Echte Käufer wollen prüfen, was sie kaufen.' },
        { title: 'Keine Links oder Datenabfragen', detail: 'Es wird nichts verlangt, was missbraucht werden könnte.' },
      ],
      recommendations: [
        'Vereinbare die Übergabe an einem Ort, an dem du dich wohlfühlst.',
        'Prüfe größere Geldscheine bei der Übergabe kurz auf Echtheit.',
        'Bleib für Absprachen im Plattform-Chat.',
      ],
      ifAlreadyInteracted: [],
      questionsToVerify: [],
      extractedText: '',
    },
  },
];

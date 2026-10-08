import type { ModelVerdict, Platform, ScamCategory, Verdict } from '../types.js';
import type { HeuristicReport } from './heuristics.js';
import { verdictFromScore } from './schema.js';

interface Advice {
  explain: string;
  recommendations: string[];
  ifAlreadyInteracted: string[];
  questions: string[];
}

const GENERAL_AFTERMATH = [
  'Hast du Geld überwiesen? Ruf sofort deine Bank an – Überweisungen lassen sich manchmal noch stoppen.',
  'Karte oder Online-Banking betroffen? Sperr-Notruf 116 116 (aus dem Ausland +49 116 116).',
  'Ändere Passwörter, die du eingegeben hast, und aktiviere die Zwei-Faktor-Anmeldung.',
  'Erstatte Anzeige bei der Polizei – das geht auch online über die Onlinewache deines Bundeslandes.',
  'Mach Screenshots von Nachrichten, Profilen und Zahlungsbelegen als Beweise.',
];

const ADVICE: Record<ScamCategory, Advice> = {
  none: {
    explain:
      'Ich habe keine typischen Betrugsmerkmale gefunden. Das heißt nicht automatisch, dass alles sicher ist – Betrüger werden immer geschickter.',
    recommendations: [
      'Prüfe den Absender über einen Weg, den du selbst kennst (offizielle App, eigene Lesezeichen).',
      'Zahle bei Unbekannten nur mit Käuferschutz und gib keine Passwörter oder Codes weiter.',
      'Wenn sich etwas komisch anfühlt: Lass dir Zeit. Seriöse Anbieter setzen dich nicht unter Druck.',
    ],
    ifAlreadyInteracted: [],
    questions: ['Kennst du den Absender wirklich – und hast du das über einen zweiten Weg geprüft?'],
  },
  phishing: {
    explain:
      'Die Nachricht will dich auf eine Seite locken oder dazu bringen, Zugangsdaten, Codes oder Zahlungsdaten preiszugeben. Das ist klassisches Phishing.',
    recommendations: [
      'Klicke nicht auf Links in der Nachricht und öffne keine Anhänge.',
      'Öffne stattdessen die offizielle App oder tippe die bekannte Adresse selbst ein.',
      'Gib niemals Passwörter, PINs, TANs oder SMS-Codes weiter – keine Bank und kein Paketdienst fragt danach.',
      'Leite Phishing an die Verbraucherzentrale (phishing@verbraucherzentrale.nrw) weiter und lösche die Nachricht.',
    ],
    ifAlreadyInteracted: [
      'Daten eingegeben? Ändere sofort das Passwort und melde dich in allen Geräten ab.',
      'Bankdaten oder TAN weitergegeben? Ruf sofort deine Bank an oder den Sperr-Notruf 116 116.',
      ...GENERAL_AFTERMATH.slice(3),
    ],
    questions: ['Erwartest du überhaupt eine Sendung oder eine Nachricht von diesem Unternehmen?'],
  },
  marketplace: {
    explain:
      'Das passt zur bekannten Kleinanzeigen-Masche: Angebliche Käufer schicken einen Link (z. B. „Sicher bezahlen“ oder Kurierdienst), auf dem du Karten- oder Bankdaten eingeben sollst – angeblich, um Geld zu empfangen.',
    recommendations: [
      'Bleib im Chat der Plattform und wechsle nicht zu WhatsApp oder E-Mail.',
      'Um Geld zu EMPFANGEN, musst du niemals Kartendaten oder Codes eingeben.',
      'Nutze nur die Bezahlfunktion direkt in der App – nicht über zugeschickte Links.',
      'Biete Abholung mit Barzahlung an. Betrüger lehnen das fast immer ab.',
      'Melde das Profil über die Meldefunktion der Plattform.',
    ],
    ifAlreadyInteracted: [
      'Kartendaten eingegeben? Lass die Karte sofort sperren (116 116) und kontrolliere die Umsätze.',
      ...GENERAL_AFTERMATH.slice(2),
    ],
    questions: ['Würde der Käufer auch persönlich vorbeikommen und bar bezahlen?'],
  },
  fake_shop: {
    explain:
      'Das Angebot zeigt typische Merkmale eines Fake-Shops: auffällig niedrige Preise und unsichere Zahlungswege. Ware kommt oft nie an.',
    recommendations: [
      'Prüfe die Shop-Adresse mit dem Fakeshop-Finder der Verbraucherzentrale.',
      'Schau ins Impressum: Gibt es eine echte Firmenadresse in der EU und eine Telefonnummer?',
      'Bezahle nie per Vorkasse oder Überweisung an Unbekannte – nur mit Käuferschutz (z. B. PayPal Waren & Dienstleistungen, Kreditkarte).',
      'Suche nach „Shopname + Erfahrungen“ oder „+ Betrug“.',
    ],
    ifAlreadyInteracted: [
      'Per Lastschrift oder Kreditkarte bezahlt? Bitte deine Bank um Rückbuchung (Chargeback).',
      'Per Überweisung bezahlt? Ruf sofort deine Bank an und bitte um einen Rückruf der Zahlung.',
      ...GENERAL_AFTERMATH.slice(3),
    ],
    questions: ['Wird der Preis von seriösen Händlern bestätigt – oder ist er unrealistisch günstig?'],
  },
  investment: {
    explain:
      'Das sieht nach Anlagebetrug aus: Hohe, „sichere“ Gewinne, oft mit Promis oder KI-Trading beworben. Auf solchen Plattformen werden Einzahlungen meist direkt veruntreut.',
    recommendations: [
      'Überweise kein Geld und installiere keine Fernwartungs-Software (AnyDesk, TeamViewer).',
      'Prüfe die Firma in der Unternehmensdatenbank der BaFin und auf deren Warnliste.',
      'Kein seriöses Investment garantiert Gewinne – hohe Rendite heißt immer hohes Risiko.',
      'Prominente werben nicht für Trading-Plattformen – solche Anzeigen sind gefälscht.',
    ],
    ifAlreadyInteracted: [
      'Stoppe weitere Zahlungen – auch wenn eine „Auszahlungsgebühr“ verlangt wird. Das ist Teil der Masche.',
      'Vorsicht vor „Recovery“-Firmen, die dir Hilfe beim Zurückholen versprechen – oft dieselben Betrüger.',
      ...GENERAL_AFTERMATH,
    ],
    questions: ['Ist der Anbieter bei der BaFin registriert?'],
  },
  romance: {
    explain:
      'Das passt zu Love-Scamming: Jemand baut eine emotionale Beziehung auf und bittet dann um Geld – für Tickets, Notfälle, Zoll oder Gebühren.',
    recommendations: [
      'Schicke kein Geld, keine Gutscheinkarten und keine Krypto an Menschen, die du nie getroffen hast.',
      'Mach eine Bilder-Rückwärtssuche der Profilfotos (z. B. Google Lens).',
      'Schlage einen Videoanruf vor – Betrüger weichen fast immer aus.',
      'Sprich mit einer Vertrauensperson darüber. Das ist kein Grund, sich zu schämen.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Hast du die Person schon einmal live per Video gesehen?'],
  },
  family_emergency: {
    explain:
      'Das ist sehr wahrscheinlich die „Hallo Mama/Papa“-Masche: Betrüger geben sich als dein Kind oder Enkel mit neuer Nummer aus und bitten schnell um Geld.',
    recommendations: [
      'Ruf dein Kind/Enkelkind unter der ALTEN, bekannten Nummer an.',
      'Stell eine Frage, die nur die echte Person beantworten kann.',
      'Überweise nichts, solange du nicht mit der Person gesprochen hast.',
      'Blockiere und melde die neue Nummer in WhatsApp.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Hast du die Person unter ihrer alten Nummer erreicht?'],
  },
  job: {
    explain:
      'Das passt zu Job-Betrug: Leichtes Geld für einfache „Aufgaben“, Paketweiterleitung oder Video-Ident-Tests. Oft wirst du zum Geldwäscher gemacht oder sollst selbst einzahlen.',
    recommendations: [
      'Zahle niemals Geld, um an einen Job oder an „Provisionen“ zu kommen.',
      'Mach keine Video-Ident-Verfahren für fremde Konten – damit werden Konten auf deinen Namen eröffnet.',
      'Leite keine Pakete oder Gelder für Fremde weiter (Geldwäsche!).',
      'Prüfe das Unternehmen: Gibt es eine echte Website, ein Impressum und Bewertungen?',
    ],
    ifAlreadyInteracted: [
      'Ausweis oder Video-Ident gemacht? Informiere deine Bank und die Polizei – es könnte ein Konto auf deinen Namen eröffnet worden sein.',
      'Hol dir eine kostenlose SCHUFA-Selbstauskunft, um neue Konten zu entdecken.',
      ...GENERAL_AFTERMATH.slice(3),
    ],
    questions: ['Gibt es einen schriftlichen Arbeitsvertrag mit einer echten, prüfbaren Firma?'],
  },
  advance_fee: {
    explain:
      'Das ist typischer Vorschussbetrug: Dir wird Geld, ein Gewinn oder ein Erbe versprochen – vorher sollst du aber eine Gebühr zahlen. Das Geld gibt es nicht.',
    recommendations: [
      'Zahle keine Gebühren, um angeblich Geld zu erhalten.',
      'Antworte nicht und gib keine persönlichen Daten preis.',
      'Lösche die Nachricht oder melde sie als Spam.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Warum solltest du Geld bezahlen, um Geld zu bekommen?'],
  },
  lottery: {
    explain:
      'Ein Gewinn, für den du nie mitgespielt hast – und für den du vorher etwas zahlen oder Daten angeben sollst? Das ist eine bekannte Gewinnspiel-Masche.',
    recommendations: [
      'Echte Gewinne kosten nie eine Gebühr.',
      'Ruf keine angegebenen Nummern zurück und gib keine Kontodaten an.',
      'Melde das Profil oder die Nachricht als Spam.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Hast du an diesem Gewinnspiel wirklich teilgenommen?'],
  },
  tech_support: {
    explain:
      'Das ist eine Fake-Support-Masche: Eine falsche Virenwarnung oder ein angeblicher Techniker will Zugriff auf deinen Computer oder Geld für eine „Reparatur“.',
    recommendations: [
      'Ruf keine Nummern aus Pop-ups oder Anrufen an. Microsoft und Apple rufen nie unaufgefordert an.',
      'Installiere keine Fernwartungs-Software auf Anweisung von Fremden.',
      'Schließe den Browser (notfalls über den Task-Manager) – die Warnung ist harmlos, solange du nichts tust.',
    ],
    ifAlreadyInteracted: [
      'Fernzugriff gewährt? Trenne das Gerät vom Internet und lass es von einer Fachperson prüfen.',
      ...GENERAL_AFTERMATH,
    ],
    questions: ['Hast du selbst Support angefragt – oder kam die Warnung ungefragt?'],
  },
  impersonation: {
    explain:
      'Jemand gibt sich als Behörde, Bank, Polizei oder bekanntes Unternehmen aus, um Druck aufzubauen und an Geld oder Daten zu kommen.',
    recommendations: [
      'Kontaktiere die Organisation über die offizielle Nummer – nicht über Kontakte aus der Nachricht.',
      'Echte Polizei und Behörden fordern nie Geld per Telefon, Gutscheinkarte oder Krypto.',
      'Lass dich nicht unter Druck setzen und leg im Zweifel einfach auf.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Hast du die Organisation selbst über die offizielle Nummer kontaktiert?'],
  },
  subscription_trap: {
    explain:
      'Das sieht nach einer möglichen Abofalle aus: „Gratis“-Test, der sich in ein teures Abo verwandelt, oft versteckt im Kleingedruckten.',
    recommendations: [
      'Lies AGB und Preisangaben genau, bevor du Zahlungsdaten eingibst.',
      'Prüfe, ob und wie du kündigen kannst.',
      'Bei Online-Käufen gilt in der Regel ein 14-tägiges Widerrufsrecht.',
    ],
    ifAlreadyInteracted: [
      'Widerrufe den Vertrag schriftlich (E-Mail mit Datum) innerhalb von 14 Tagen.',
      'Lass dich bei der Verbraucherzentrale beraten, bevor du zahlst.',
    ],
    questions: ['Steht klar und deutlich, was es nach der Testphase kostet?'],
  },
  rental: {
    explain:
      'Das passt zum Wohnungsbetrug: Attraktive Wohnung, Vermieter „im Ausland“, Schlüssel per Post, Kaution vorab. Die Wohnung gibt es so meist nicht.',
    recommendations: [
      'Zahle nie Kaution oder Miete vor einer Besichtigung und Vertragsunterzeichnung.',
      'Schicke keine Ausweiskopien an Unbekannte.',
      'Mach eine Bilder-Rückwärtssuche der Wohnungsfotos.',
      'Prüfe die Adresse vor Ort oder auf einer Karte.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Kannst du die Wohnung persönlich besichtigen, bevor du zahlst?'],
  },
  sextortion: {
    explain:
      'Das ist eine Erpressungs-Masche mit angeblichen intimen Aufnahmen. In fast allen Fällen existieren diese Aufnahmen nicht – es ist ein Massen-Bluff.',
    recommendations: [
      'Zahle nicht und antworte nicht.',
      'Ändere vorsichtshalber das Passwort des betroffenen E-Mail-Kontos.',
      'Erstatte Anzeige bei der Polizei. Du hast nichts falsch gemacht.',
    ],
    ifAlreadyInteracted: ['Brich den Kontakt ab, sichere Beweise und wende dich an die Polizei.', ...GENERAL_AFTERMATH.slice(2)],
    questions: [],
  },
  charity: {
    explain: 'Der Spendenaufruf zeigt Merkmale, die auf Betrug hindeuten können – etwa private Konten oder starker emotionaler Druck.',
    recommendations: [
      'Spende nur an Organisationen mit DZI-Spendensiegel oder bekannter Reputation.',
      'Überweise nicht auf Privatkonten.',
      'Prüfe die Organisation über ihre offizielle Website.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH.slice(0, 2),
    questions: ['Ist die Organisation offiziell eingetragen und hat ein Spendensiegel?'],
  },
  other: {
    explain: 'Die Nachricht enthält mehrere Merkmale, die häufig bei Betrug vorkommen.',
    recommendations: [
      'Reagiere nicht vorschnell und gib keine Daten oder Codes weiter.',
      'Prüfe den Absender über einen unabhängigen, offiziellen Weg.',
      'Zahle nur mit Käuferschutz.',
    ],
    ifAlreadyInteracted: GENERAL_AFTERMATH,
    questions: ['Kannst du den Absender über einen zweiten, unabhängigen Weg erreichen?'],
  },
};

const HEADLINES: Record<Verdict, (cat: string) => string> = {
  safe: () => 'Keine typischen Warnsignale gefunden.',
  unclear: () => 'Keine eindeutigen Warnsignale – bleib trotzdem aufmerksam.',
  suspicious: (cat) => `Vorsicht: Es gibt Hinweise auf ${cat}.`,
  likely_scam: (cat) => `Sehr wahrscheinlich Betrug (${cat}).`,
  scam: (cat) => `Achtung, das ist Betrug (${cat}).`,
};

const CATEGORY_NOUN: Record<ScamCategory, string> = {
  none: 'Betrug',
  phishing: 'Phishing',
  marketplace: 'Kleinanzeigen-Betrug',
  fake_shop: 'einen Fake-Shop',
  investment: 'Anlagebetrug',
  romance: 'Love-Scamming',
  family_emergency: 'die „Hallo Mama“-Masche',
  job: 'Job-Betrug',
  advance_fee: 'Vorschussbetrug',
  lottery: 'Gewinnspiel-Betrug',
  tech_support: 'Fake-Support',
  impersonation: 'Identitätsbetrug',
  subscription_trap: 'eine Abofalle',
  rental: 'Wohnungsbetrug',
  sextortion: 'Erpressung',
  charity: 'Spendenbetrug',
  other: 'Betrug',
};

export function adviceFor(category: ScamCategory): Advice {
  return ADVICE[category];
}

/**
 * Builds a complete verdict from the pattern engine alone. Used when no AI
 * provider is configured or the provider fails. Deliberately never says "safe":
 * the absence of known patterns is not proof of legitimacy.
 */
export function heuristicVerdict(report: HeuristicReport, platform: Platform): ModelVerdict {
  let verdict = verdictFromScore(report.score);
  if (verdict === 'safe') verdict = 'unclear';
  const category = report.category;
  const advice = ADVICE[category];
  const noun = CATEGORY_NOUN[category];

  const redFlags = report.signals.slice(0, 8).map((s) => ({
    title: s.label,
    detail:
      s.id === 'risky_links' || s.id === 'brand_link_mismatch'
        ? 'Der Link wurde automatisch untersucht (nicht geöffnet). Details siehe Link-Analyse.'
        : 'Dieses Muster kommt in Betrugsnachrichten häufig vor.',
    evidence: s.matches[0] ?? '',
    severity: (s.weight >= 0.45 ? 'high' : s.weight >= 0.25 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
  }));

  const platformHint =
    platform === 'marketplace' && category !== 'marketplace' && report.score >= 40
      ? ' Auf Kleinanzeigen-Plattformen gilt: Bleib im Plattform-Chat und zahle nur mit Käuferschutz.'
      : '';

  return {
    riskScore: report.score,
    verdict,
    confidence: report.signals.length >= 3 ? 'medium' : 'low',
    category,
    headline: HEADLINES[verdict](noun),
    summary:
      (report.score < 20
        ? 'Die automatische Mustererkennung hat nichts Auffälliges gefunden. Sie kennt aber nicht jede Masche – für eine gründlichere Prüfung kann der Betreiber eine KI-Analyse aktivieren.'
        : `${advice.explain} Diese Einschätzung stammt aus der automatischen Mustererkennung (ohne KI).`) + platformHint,
    redFlags,
    greenFlags: report.urls
      .filter((u) => u.issues.some((i) => i.startsWith('Offizielle Domain')))
      .slice(0, 3)
      .map((u) => ({ title: `Offizielle Domain: ${u.registrableDomain}`, detail: 'Der Link gehört zur echten Domain. Prüfe trotzdem, ob du die Nachricht erwartet hast.' })),
    recommendations: report.score < 20 ? ADVICE.none.recommendations : advice.recommendations,
    ifAlreadyInteracted: report.score < 20 ? [] : advice.ifAlreadyInteracted,
    questionsToVerify: advice.questions,
    extractedText: '',
  };
}

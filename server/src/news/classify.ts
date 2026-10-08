export const TOPICS = ['scam', 'phishing', 'malware', 'breach', 'vulnerability', 'privacy', 'ai', 'mobile'] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  scam: 'Betrug & Maschen',
  phishing: 'Phishing',
  malware: 'Schadsoftware',
  breach: 'Datenlecks',
  vulnerability: 'Sicherheitslücken',
  privacy: 'Datenschutz',
  ai: 'KI & Deepfakes',
  mobile: 'Smartphone',
};

const PATTERNS: Record<Topic, RegExp> = {
  scam: /betrug|betrüger|abzocke|masche|fake-?shop|fakeshop|scam|fraud|schockanruf|enkeltrick|love-?scam|abofalle|anlagebetrug|krypto-?betrug|gewinnspiel|kleinanzeigen|vorsicht vor|warnung vor|warnt vor|falsche[nr]? (?:polizist|bankmitarbeiter|mitarbeiter)|sextortion|erpress/i,
  phishing: /phishing|smishing|vishing|quishing|gefälschte (?:e-?mail|sms|nachricht|seite|website)|fake-?(?:mail|sms)|zugangsdaten|login-?seite|credential/i,
  malware: /malware|ransomware|trojaner|trojan|virus|viren|spyware|stealer|botnet|backdoor|schadsoftware|schadcode|wurm|worm|infostealer|rootkit/i,
  breach: /datenleck|datenpanne|daten-?leak|leak|breach|gehackt|hacked|hackerangriff|cyberangriff|cyberattack|gestohlen|stolen data|kundendaten|exposed/i,
  vulnerability: /sicherheitslücke|schwachstelle|lücke|vulnerab|cve-\d|zero-?day|0-?day|patch|update|exploit|sicherheitsupdate|notfall-?update/i,
  privacy: /datenschutz|privatsphäre|privacy|dsgvo|gdpr|tracking|überwachung|surveillance/i,
  ai: /\bki\b|künstliche intelligenz|\bai\b|deepfake|chatgpt|llm|voice clon|stimmen-?klon|geklont/i,
  mobile: /android|iphone|ios|smartphone|handy|whatsapp|app-?store|google play|sms/i,
};

export function classify(text: string): Topic[] {
  return TOPICS.filter((t) => PATTERNS[t].test(text));
}

/** A consumer-relevant warning: scam/phishing topics, or anything from consumer-protection sources. */
export function isWarning(topics: Topic[], kind: 'consumer' | 'tech' | 'gov'): boolean {
  return kind === 'consumer' || topics.includes('scam') || topics.includes('phishing');
}

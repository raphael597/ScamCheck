export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  lang: 'de' | 'en';
  /** consumer = Verbraucherwarnungen, tech = IT-Sicherheitsnachrichten, gov = Behörden */
  kind: 'consumer' | 'tech' | 'gov';
  enabled: boolean;
}

/**
 * Default feed list. URLs can be changed in the admin area without a rebuild.
 * Consumer-focused German sources come first because they matter most for scam awareness.
 */
export const DEFAULT_FEEDS: FeedConfig[] = [
  { id: 'watchlist-internet', name: 'Watchlist Internet', url: 'https://www.watchlist-internet.at/rss/', lang: 'de', kind: 'consumer', enabled: true },
  { id: 'mimikama', name: 'Mimikama', url: 'https://www.mimikama.org/feed/', lang: 'de', kind: 'consumer', enabled: true },
  { id: 'verbraucherzentrale-nrw', name: 'Verbraucherzentrale NRW', url: 'https://www.verbraucherzentrale.nrw/aktuelle-meldungen/feed', lang: 'de', kind: 'consumer', enabled: true },
  { id: 'bsi', name: 'BSI', url: 'https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml', lang: 'de', kind: 'gov', enabled: true },
  { id: 'heise-security', name: 'heise Security', url: 'https://www.heise.de/security/rss/news-atom.xml', lang: 'de', kind: 'tech', enabled: true },
  { id: 'golem-security', name: 'Golem Security', url: 'https://rss.golem.de/rss.php?tp=sec&feed=RSS2.0', lang: 'de', kind: 'tech', enabled: true },
  { id: 'welivesecurity-de', name: 'WeLiveSecurity', url: 'https://www.welivesecurity.com/de/rss/feed/', lang: 'de', kind: 'tech', enabled: true },
  { id: 'bleepingcomputer', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', lang: 'en', kind: 'tech', enabled: true },
  { id: 'the-hacker-news', name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', lang: 'en', kind: 'tech', enabled: true },
  { id: 'krebs-on-security', name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', lang: 'en', kind: 'tech', enabled: true },
];

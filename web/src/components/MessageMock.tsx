import { Briefcase, CircleAlert, Globe, Heart, House, Mail, MessageCircle, MessageSquare, ShoppingBag, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DemoCase, Severity } from '../lib/types';
import './mock.css';

export interface Highlight {
  text: string;
  severity: Severity;
}

/** Finds evidence fragments in the text (evidence may be shortened with "…"). */
function findRanges(text: string, highlights: Highlight[]) {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; severity: Severity; order: number }[] = [];
  highlights.forEach((h, order) => {
    for (const frag of h.text.split(/…|\.\.\./)) {
      const f = frag.trim().replace(/^[„“"']+|[“”"']+$/g, '');
      if (f.length < 5) continue;
      const idx = lower.indexOf(f.toLowerCase());
      if (idx >= 0) ranges.push({ start: idx, end: idx + f.length, severity: h.severity, order });
    }
  });
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      if (r.severity === 'high') last.severity = 'high';
    } else merged.push({ ...r });
  }
  return merged;
}

function Highlighted({ text, highlights, active }: { text: string; highlights: Highlight[]; active: boolean }) {
  if (!active || !highlights.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let pos = 0;
  findRanges(text, highlights).forEach((r, i) => {
    if (r.start > pos) parts.push(text.slice(pos, r.start));
    parts.push(
      <mark key={i} className={`hl sev-${r.severity}`} style={{ '--i': r.order } as React.CSSProperties}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  });
  parts.push(text.slice(pos));
  return <>{parts}</>;
}

const ICONS = {
  sms: MessageSquare,
  whatsapp: MessageCircle,
  email: Mail,
  marketplace: Store,
  social: Heart,
  shop: ShoppingBag,
  job: Briefcase,
  rental: House,
} as const;

export function channelIcon(kind: DemoCase['channel']['kind']) {
  return ICONS[kind] ?? Globe;
}

const CHANNEL_NAME: Record<DemoCase['channel']['kind'], string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'E-Mail',
  marketplace: 'Kleinanzeigen-Chat',
  social: 'Social Media',
  shop: 'Online-Shop',
  job: 'Jobangebot',
  rental: 'Wohnungsanzeige',
};

interface Props {
  demo: DemoCase;
  /** Characters of the text revealed so far (typing animation). */
  revealed: number;
  scanning: boolean;
  highlights: Highlight[];
  showHighlights: boolean;
}

/** Renders a demo case the way it would look on the phone or in the browser. */
export function MessageMock({ demo, revealed, scanning, highlights, showHighlights }: Props) {
  const { channel } = demo;
  const shown = demo.text.slice(0, revealed);
  const typing = revealed < demo.text.length;
  const Icon = channelIcon(channel.kind);
  const body = (
    <p className="mock-text">
      <Highlighted text={shown} highlights={highlights} active={showHighlights && !typing} />
      {typing && <span className="caret" aria-hidden="true" />}
    </p>
  );

  return (
    <div className={`mock mock--${channel.kind} ${scanning ? 'is-scanning' : ''}`}>
      <div className="mock-chrome">
        <span className="mock-app">
          <Icon size={15} aria-hidden="true" /> {CHANNEL_NAME[channel.kind]}
        </span>
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>

      {channel.kind === 'email' ? (
        <div className="mock-mail">
          <div className="mail-row">
            <span>Von</span>
            <strong>{channel.sender}</strong>
          </div>
          <div className="mail-row">
            <span>Betreff</span>
            <strong>{channel.subject}</strong>
          </div>
          <div className="mail-body">{body}</div>
        </div>
      ) : channel.kind === 'shop' ? (
        <div className="mock-shop">
          <div className="shop-url">
            <Globe size={13} aria-hidden="true" /> {channel.sender}
          </div>
          <div className="shop-product">
            <div className="shop-img" aria-hidden="true">
              <ShoppingBag size={40} />
            </div>
            <div>
              {channel.price && <div className="shop-price">{channel.price}</div>}
              {body}
            </div>
          </div>
        </div>
      ) : channel.kind === 'social' ? (
        <div className="mock-post">
          <div className="post-head">
            <span className="avatar">{channel.sender.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{channel.sender}</strong>
              <small>{channel.meta}</small>
            </span>
          </div>
          {body}
        </div>
      ) : (
        <div className="mock-chat">
          <div className="chat-head">
            <span className="avatar">{channel.sender.replace(/[^A-Za-zÄÖÜäöü0-9]/g, '').slice(0, 1).toUpperCase() || '?'}</span>
            <span>
              <strong>{channel.sender}</strong>
              {channel.meta && <small>{channel.meta}</small>}
            </span>
            {channel.kind === 'marketplace' && channel.price && <span className="chat-price">{channel.price}</span>}
          </div>
          {(channel.kind === 'whatsapp' || channel.kind === 'job') && (
            <div className="chat-banner">
              <CircleAlert size={14} aria-hidden="true" /> Nicht in deinen Kontakten
            </div>
          )}
          <div className="chat-bubble">{body}</div>
        </div>
      )}

      {scanning && <span className="mock-scan" aria-hidden="true" />}
    </div>
  );
}

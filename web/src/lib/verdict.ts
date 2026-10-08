import type { MascotMotion, Pose } from '../components/Mascot';
import type { Verdict } from './types';

interface VerdictStyle {
  label: string;
  pose: Pose;
  motion: MascotMotion;
  /** What Checky says right after the result appears. */
  say: string;
}

export const VERDICT_STYLE: Record<Verdict, VerdictStyle> = {
  safe: {
    label: 'Wahrscheinlich sicher',
    pose: 'reliable',
    motion: 'bounce',
    say: 'Puh, sieht gut aus! Ich habe keine typischen Warnsignale gefunden.',
  },
  unclear: {
    label: 'Unklar',
    pose: 'curious',
    motion: 'think',
    say: 'Hmm, ganz sicher bin ich mir nicht. Schau dir meine Prüffragen an.',
  },
  suspicious: {
    label: 'Verdächtig',
    pose: 'curious',
    motion: 'think',
    say: 'Da ist einiges komisch. Lieber nicht vorschnell reagieren!',
  },
  likely_scam: {
    label: 'Sehr wahrscheinlich Betrug',
    pose: 'protect',
    motion: 'alert',
    say: 'Vorsicht! Das hat starke Ähnlichkeit mit einer bekannten Masche.',
  },
  scam: {
    label: 'Betrug',
    pose: 'protect',
    motion: 'alert',
    say: 'Finger weg! Das ist Betrug. Aber keine Sorge – ich sag dir, was jetzt zu tun ist.',
  },
};

export const PLATFORM_OPTIONS = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'E-Mail' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'marketplace', label: 'Kleinanzeigen' },
  { id: 'social', label: 'Social Media' },
  { id: 'shop', label: 'Online-Shop' },
  { id: 'job', label: 'Jobangebot' },
  { id: 'rental', label: 'Wohnung' },
  { id: 'dating', label: 'Dating' },
  { id: 'phone', label: 'Anruf' },
  { id: 'other', label: 'Sonstiges' },
] as const;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

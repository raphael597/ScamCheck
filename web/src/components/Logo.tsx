import { useId } from 'react';

/** Shield mark with Checky's head and the magnifier – a vector version of the brand logo. */
export function LogoMark({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d5fe0" />
          <stop offset="1" stopColor="#14b39a" />
        </linearGradient>
      </defs>
      <path d="M32 3 55 11v19c0 15-10 25-23 31C19 55 9 45 9 30V11z" fill={`url(#${id}-g)`} />
      <path d="M32 14v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="12.5" r="2.8" fill="#8fdcff" className="logo-antenna" />
      <rect x="14.5" y="27" width="4.5" height="9" rx="2.2" fill="#9fd0ff" />
      <rect x="45" y="27" width="4.5" height="9" rx="2.2" fill="#9fd0ff" />
      <rect x="17" y="20" width="30" height="22" rx="10" fill="#fff" />
      <rect x="21" y="24" width="22" height="14" rx="6" fill="#0b1633" />
      <path d="M25.3 32.6q2.6-3.6 5.2 0M33.5 32.6q2.6-3.6 5.2 0" fill="none" stroke="#3fd6ff" strokeWidth="2.1" strokeLinecap="round" />
      <path d="m49.6 51.6 5.6 5.6" stroke="#0b1633" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="46" r="8" fill="#fff" stroke="#0b1633" strokeWidth="2.6" />
      <path d="m40.4 46.1 2.5 2.5 4.6-5" fill="none" stroke="#14b39a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-text">
        <span className="logo-word">
          Scam<span className="logo-check">Check</span>
        </span>
        {tagline && <span className="logo-tagline">Against cyber crime</span>}
      </span>
    </span>
  );
}

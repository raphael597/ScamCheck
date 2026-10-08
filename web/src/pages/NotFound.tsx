import { House, ScanSearch } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Mascot } from '../components/Mascot';

export function NotFoundPage() {
  return (
    <div className="container not-found">
      <Mascot pose="curious" size={190} say="Hmm … diese Seite finde ich nicht. Vielleicht hat sich ein Tippfehler eingeschlichen?" bubbleSide="right" />
      <div className="not-found-actions">
        <Link to="/" className="btn">
          <House size={18} aria-hidden="true" /> Zur Startseite
        </Link>
        <Link to="/pruefen" className="btn btn-primary">
          <ScanSearch size={18} aria-hidden="true" /> Nachricht prüfen
        </Link>
      </div>
    </div>
  );
}

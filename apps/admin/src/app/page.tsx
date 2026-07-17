/**
 * Entry point for the private administration and research console.
 */
import Link from 'next/link';
import { BlackBookMark, brandPalette } from '@black-book/ui';

export default function AdminHomePage() {
  return (
    <main className="bb-container bb-prose">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span aria-hidden="true" style={{ display: 'block', width: 28, height: 28 }}>
          <BlackBookMark
            ink={brandPalette.blackInk}
            paper={brandPalette.archivePaper}
            accent={brandPalette.copperPin}
            pageColors={[brandPalette.copperPin, brandPalette.archivePaper]}
            detail="compact"
          />
        </span>
        Black Book Admin
      </h1>
      <p>Research and publication console scaffold. Not publicly reachable by design.</p>
      <Link className="bb-button bb-button--primary" href="/console">
        Open administration console
      </Link>
    </main>
  );
}

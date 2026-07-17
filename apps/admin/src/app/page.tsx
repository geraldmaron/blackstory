/**
 * Entry point for the private administration and research console.
 */
import Link from 'next/link';
import { BrandMark } from '@black-book/ui';

export default function AdminHomePage() {
  return (
    <main className="bb-container bb-prose">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <BrandMark variant="mono" size={28} decorative style={{ color: '#000' }} />
        Black Book Admin
      </h1>
      <p>Research and publication console scaffold. Not publicly reachable by design.</p>
      <Link className="bb-button bb-button--primary" href="/console">
        Open administration console
      </Link>
    </main>
  );
}

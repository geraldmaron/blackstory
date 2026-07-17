/**
 * Entry point for the private administration and research console.
 */
import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <main className="bb-container bb-prose">
      {/*
        Official lockup artwork only — the symbol IS the first B, so the
        product name is never typed beside the mark. The admin shell has no
        dark theme toggle, so the light lockup is used directly.
      */}
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src="/brand/black-book-primary-light.svg"
          alt="Black Book"
          style={{ display: 'block', width: 168, height: 'auto' }}
        />
        Admin
      </h1>
      <p>Research and publication console scaffold. Not publicly reachable by design.</p>
      <Link className="bb-button bb-button--primary" href="/console">
        Open administration console
      </Link>
    </main>
  );
}

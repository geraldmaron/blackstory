/**
 * Entry point for the private administration and research console.
 */
import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <main className="ds-container ds-prose">
      {/*
        Official lockup artwork only — the product name is never typed beside
        the mark. The admin shell has no dark theme toggle, so the light
        lockup is used directly.
      */}
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src="/brand/lockup-light.png"
          alt="BlackStory"
          style={{ display: 'block', width: 168, height: 'auto' }}
        />
        Admin
      </h1>
      <p>Research and publication console scaffold. Not publicly reachable by design.</p>
      <Link className="ds-button ds-button--primary" href="/console">
        Open administration console
      </Link>
    </main>
  );
}

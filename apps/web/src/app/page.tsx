/**
 * Public Black Book web application landing (Firebase App Hosting target).
 * Full product shell lands in BB-048; design-system fixtures live at /design-system.
 */
export default function HomePage() {
  return (
    <main className="bb-container" id="main" style={{ paddingBlock: 'var(--bb-space-12)' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 1.6rem + 2vw, 2.75rem)' }}>Black Book</h1>
      <p className="bb-prose" style={{ color: 'var(--bb-ink-muted)' }}>
        Place-connected Black history research. Public product shell arrives in BB-048.
      </p>
      <p>
        <a href="/design-system">Open design system fixtures</a>
      </p>
    </main>
  );
}

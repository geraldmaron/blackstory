/**
 * Segment-level loading UI for public routes.
 */

export default function Loading() {
  return (
    <main className="bb-container bb-loading" id="main" aria-busy="true" aria-live="polite">
      <p className="bb-visually-hidden">Loading page content</p>
      <div className="bb-loading__bar bb-loading__bar--wide" />
      <div className="bb-loading__bar" />
      <div className="bb-loading__bar" style={{ width: 'min(100%, 32rem)' }} />
    </main>
  );
}

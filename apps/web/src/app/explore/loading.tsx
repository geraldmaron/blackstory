/**
 * Instant loading state for `/explore`.
 *
 * The Atlas route is `force-dynamic` (see page.tsx): every visit renders the shell from the
 * in-process catalog, and a cold instance first has to load that catalog (CDN artifact, or
 * Postgres if the artifact is unusable), which can take several seconds. Without this file
 * Next shows nothing at all while that RSC payload streams, so a click on "Explore" reads as
 * broken rather than slow. This is the App Router's own loading-UI convention (a sibling
 * `loading.tsx` wraps the route in Suspense automatically) — no new pattern, just the one this
 * route was missing.
 */
import './loading.css';

export default function ExploreLoading() {
  return (
    <div className="ds-explore-loading" role="status" aria-live="polite">
      <span className="ds-explore-loading__mark" aria-hidden="true" />
      <p className="ds-explore-loading__label">Loading the archive…</p>
    </div>
  );
}

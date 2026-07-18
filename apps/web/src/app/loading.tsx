/**
 * Segment-level loading UI for public routes.
 */

import { StatusPage } from '../components/StatusPage';

export default function Loading() {
  return (
    <StatusPage eyebrow="Loading" title="Loading page" busy>
      <p className="bp-visually-hidden">Loading page content</p>
      <div className="bp-loading" aria-hidden="true">
        <div className="bp-loading__bar bp-loading__bar--wide" />
        <div className="bp-loading__bar" />
        <div className="bp-loading__bar" style={{ width: 'min(100%, 32rem)' }} />
      </div>
    </StatusPage>
  );
}

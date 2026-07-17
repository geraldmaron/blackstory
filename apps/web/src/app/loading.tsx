/**
 * Segment-level loading UI for public routes.
 */

import { StatusPage } from '../components/StatusPage';

export default function Loading() {
  return (
    <StatusPage eyebrow="Loading" title="Loading page" busy>
      <p className="bb-visually-hidden">Loading page content</p>
      <div className="bb-loading" aria-hidden="true">
        <div className="bb-loading__bar bb-loading__bar--wide" />
        <div className="bb-loading__bar" />
        <div className="bb-loading__bar" style={{ width: 'min(100%, 32rem)' }} />
      </div>
    </StatusPage>
  );
}

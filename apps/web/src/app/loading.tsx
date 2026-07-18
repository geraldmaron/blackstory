/**
 * Segment-level loading UI for public routes.
 */

import { StatusPage } from '../components/StatusPage';

export default function Loading() {
  return (
    <StatusPage eyebrow="Loading" title="Loading page" busy>
      <p className="ds-visually-hidden">Loading page content</p>
      <div className="ds-loading" aria-hidden="true">
        <div className="ds-loading__bar ds-loading__bar--wide" />
        <div className="ds-loading__bar" />
        <div className="ds-loading__bar" style={{ width: 'min(100%, 32rem)' }} />
      </div>
    </StatusPage>
  );
}

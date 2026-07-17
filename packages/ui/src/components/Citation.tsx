/**
 * Citation block with source label and optional external link (non-color provenance cue).
 *
 * BB-083 additive: an optional `linkStatus` prop renders the reader-facing degraded-citation
 * treatment (owner brief 2026-07-17's "mark dead links, offer a search term" pattern) for
 * 'dead' or 'drifted' citations. Every prop below `className` is optional and defaults to the
 * original alive-citation rendering, so every existing `<Citation source=... href=... />`
 * call site (apps/web/src/app/entity/[id]/page.tsx, apps/web/src/app/methodology/page.tsx,
 * apps/web/src/app/design-system/page.tsx) renders exactly as before.
 */

import type { ReactNode } from 'react';
import { cx } from '../utils/cx.js';

export type CitationLinkStatus = 'alive' | 'redirected' | 'drifted' | 'dead';

export type CitationProps = {
  readonly label?: string;
  readonly source: string;
  readonly href?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  /** BB-083: when set to 'dead' or 'drifted', renders the degraded-citation notice below the
   *  normal citation block. Omitted (the default) renders exactly as before this addition. */
  readonly linkStatus?: CitationLinkStatus;
  /** ISO date the link was last confirmed dead — rendered as "link dead as of <date>". */
  readonly deadAsOfDate?: string;
  /** Archived-copy URL (typically a Wayback capture), shown when available for a dead link. */
  readonly archivedHref?: string;
  /** Deterministic suggestion text from `buildTrySearchingForSuggestion`
   *  (packages/domain/src/citations/try-searching-for.ts) — no LLM call is made to produce it. */
  readonly trySearchingFor?: string;
};

export function Citation({
  label = 'Source',
  source,
  href,
  children,
  className,
  linkStatus,
  deadAsOfDate,
  archivedHref,
  trySearchingFor,
}: CitationProps) {
  return (
    <aside className={cx('bb-citation', className)} aria-label={label}>
      <span className="bb-citation__label">{label}</span>
      {href ? (
        <a href={href} rel="noopener noreferrer">
          {source}
        </a>
      ) : (
        <span>{source}</span>
      )}
      {children}
      {linkStatus === 'dead' ? (
        <div className="bb-notice bb-notice--warning" role="status">
          <span className="bb-notice__cue" aria-hidden="true">
            Warning
          </span>
          <div>
            <p className="bb-notice__title">
              {archivedHref
                ? 'Original link unavailable — archived copy'
                : `Link dead${deadAsOfDate ? ` as of ${deadAsOfDate}` : ''}`}
            </p>
            <div className="bb-notice__body">
              {archivedHref ? (
                <p>
                  <a href={archivedHref} rel="noopener noreferrer">
                    View archived copy
                  </a>
                  {deadAsOfDate ? <span> · link dead as of {deadAsOfDate}</span> : null}
                </p>
              ) : null}
              {trySearchingFor ? <p>{trySearchingFor}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      {linkStatus === 'drifted' ? (
        <div className="bb-notice bb-notice--dispute" role="status">
          <span className="bb-notice__cue" aria-hidden="true">
            Disputed
          </span>
          <div>
            <p className="bb-notice__title">Content may have changed since capture</p>
            <div className="bb-notice__body">
              <p>
                This link is reachable, but its current content no longer matches what was
                captured. Flagged for research review — the original capture remains the
                evidentiary anchor for this citation.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

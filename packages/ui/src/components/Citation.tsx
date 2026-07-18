
/**
 * Citation block with source label and optional external link (non-color provenance cue).
 *
 * An optional `linkStatus` prop renders the reader-facing degraded-citation treatment
 * (mark dead links, offer a search term) for 'dead' or 'drifted' citations. Every prop
 * below `className` is optional and defaults to the original alive-citation rendering, so
 * existing `<Citation source=... href=... />` call sites render exactly as before.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type CitationLinkStatus = 'alive' | 'redirected' | 'drifted' | 'dead';

export type CitationProps = {
  readonly label?: string;
  readonly source: string;
  readonly href?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  /** When set to 'dead' or 'drifted', renders the degraded-citation notice below the
   * normal citation block. Omitted (the default) renders exactly as before this addition. */
  readonly linkStatus?: CitationLinkStatus;
  /** ISO date the link was last confirmed dead rendered as "link dead as of <date>". */
  readonly deadAsOfDate?: string;
  /** Archived-copy URL (typically a Wayback capture), shown when available for a dead link. */
  readonly archivedHref?: string;
  /** Deterministic suggestion text from `buildTrySearchingForSuggestion`
   * (packages/domain/src/citations/try-searching-for.ts); no LLM call is made to produce it. */
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
    <aside className={cx('bp-citation', className)} aria-label={label}>
      <span className="bp-citation__label">{label}</span>
      {href ? (
        <a href={href} rel="noopener noreferrer">
          {source}
        </a>
      ) : (
        <span>{source}</span>
      )}
      {children}
      {linkStatus === 'dead' ? (
        <div className="bp-notice bp-notice--warning" role="status">
          <span className="bp-notice__cue" aria-hidden="true">
            Warning
          </span>
          <div>
            <p className="bp-notice__title">
              {archivedHref
                ? 'Original link unavailable — archived copy'
                : `Link dead${deadAsOfDate ? ` as of ${deadAsOfDate}` : ''}`}
            </p>
            <div className="bp-notice__body">
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
        <div className="bp-notice bp-notice--dispute" role="status">
          <span className="bp-notice__cue" aria-hidden="true">
            Disputed
          </span>
          <div>
            <p className="bp-notice__title">Content may have changed since capture</p>
            <div className="bp-notice__body">
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

/**
 * Result-range pagination for operator tables.
 *
 * States the real range and total ("51–100 of 3,195"), because an operator working a queue needs
 * to know how much is left, not just that a next page exists. Links are plain anchors so paging
 * is a server navigation.
 */

import React from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type PaginationProps = {
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hrefForPage: (page: number) => string;
  readonly itemLabel?: string;
  readonly className?: string;
};

/**
 * Page numbers around the current page, with the first and last always reachable and gaps
 * marked. Keeps the control a fixed width whether there are 3 pages or 300.
 */
function pageWindow(page: number, pageCount: number): readonly (number | 'gap')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) out.push('gap');
    out.push(value);
    previous = value;
  }
  return out;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  hrefForPage,
  itemLabel = 'results',
  className,
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className={cx('ds-pagination', className)} aria-label="Pagination">
      <p className="ds-pagination__range ds-mono">
        {total === 0
          ? `No ${itemLabel}`
          : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()} ${itemLabel}`}
      </p>

      {pageCount > 1 ? (
        <ul className="ds-pagination__pages">
          <li>
            <a
              className="ds-pagination__step"
              href={hrefForPage(Math.max(1, page - 1))}
              aria-disabled={page === 1}
              rel="prev"
            >
              ← Prev
            </a>
          </li>
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <li key={`gap-${index}`} className="ds-pagination__gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={entry}>
                <a
                  className={cx(
                    'ds-pagination__page',
                    entry === page && 'ds-pagination__page--current',
                  )}
                  href={hrefForPage(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                >
                  {entry}
                </a>
              </li>
            ),
          )}
          <li>
            <a
              className="ds-pagination__step"
              href={hrefForPage(Math.min(pageCount, page + 1))}
              aria-disabled={page === pageCount}
              rel="next"
            >
              Next →
            </a>
          </li>
        </ul>
      ) : null}
    </nav>
  );
}

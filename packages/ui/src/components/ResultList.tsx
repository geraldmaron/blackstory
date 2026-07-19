/**
 * Search/result list with title, summary, and optional meta row.
 *
 * Framework-agnostic by default (`<a>`). Pass `LinkComponent` (e.g. Next.js `Link`) so
 * in-app navigations stay soft client transitions instead of full document loads.
 */

import React, { type ComponentType, type ReactNode } from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;
import { cx } from '../utils/cx.js';

export type ResultItem = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly meta?: ReactNode;
};

export type ResultListLinkProps = {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export type ResultListProps = {
  readonly items: readonly ResultItem[];
  readonly className?: string;
  readonly labelledBy?: string;
  /** Soft-nav link primitive; defaults to a native anchor. */
  readonly LinkComponent?: ComponentType<ResultListLinkProps>;
};

function DefaultResultLink({ href, className, children }: ResultListLinkProps) {
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export function ResultList({
  items,
  className,
  labelledBy,
  LinkComponent = DefaultResultLink,
}: ResultListProps) {
  const Link = LinkComponent;
  return (
    <ul className={cx('ds-result-list', className)} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.id} className="ds-result-list__item">
          <Link className="ds-result-list__link" href={item.href}>
            <h3 className="ds-result-list__title">{item.title}</h3>
            <p className="ds-result-list__summary">{item.summary}</p>
            {item.meta ? <div className="ds-result-list__meta">{item.meta}</div> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

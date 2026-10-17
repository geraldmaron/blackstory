/**
 * Layout primitives shared by every admin desk: page header, panel, stat tile, active-filter
 * chips, loading skeleton. Server-safe (no hooks), so pages render them without a client boundary.
 *
 * They exist so a desk is assembled from the same few parts instead of its own header and card
 * markup: four header systems and three table systems had accumulated. Styles live in
 * `management.css` under the `admin-base-*` names the shell already uses.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export function DeskTitleBar({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  /** One or two sentences. Longer guidance belongs in a collapsed disclosure, not the header. */
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  /** Small facts beside the title: a count, a state, an environment. */
  readonly meta?: ReactNode;
}) {
  return (
    <header className="admin-base-page-header">
      <div className="admin-base-page-header__text">
        {eyebrow ? <p className="admin-base-eyebrow">{eyebrow}</p> : null}
        <div className="admin-base-page-header__title-row">
          <h1>{title}</h1>
          {meta ? <div className="admin-base-page-header__meta">{meta}</div> : null}
        </div>
        {description ? <p className="admin-base-page-header__lede">{description}</p> : null}
      </div>
      {actions ? <div className="admin-base-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  as: Tag = 'section',
  label,
}: {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** No inner padding: for tables and lists that run edge to edge. */
  readonly flush?: boolean;
  readonly as?: 'section' | 'div' | 'aside';
  readonly label?: string;
}) {
  return (
    <Tag className="admin-base-card" {...(!title && label ? { 'aria-label': label } : {})}>
      {title || actions ? (
        <div className="admin-base-card__head">
          <div>
            {title ? <h2 className="admin-base-card__title">{title}</h2> : null}
            {description ? <p className="admin-base-card__desc">{description}</p> : null}
          </div>
          {actions ? <div className="admin-base-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div
        className={
          flush ? 'admin-base-card__body admin-base-card__body--flush' : 'admin-base-card__body'
        }
      >
        {children}
      </div>
    </Tag>
  );
}

export type StatTone = 'default' | 'attention' | 'muted';

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  readonly label: string;
  /** A number, or a short word when the count is unavailable. */
  readonly value: ReactNode;
  readonly hint?: string;
  readonly href?: string;
  readonly tone?: StatTone;
}) {
  const body = (
    <>
      <span className="admin-base-stat__label">{label}</span>
      <span className="admin-base-stat__value">{value}</span>
      {hint ? <span className="admin-base-stat__hint">{hint}</span> : null}
    </>
  );
  const className = `admin-base-stat admin-base-stat--${tone}`;
  return href ? (
    <Link className={`${className} admin-base-stat--link`} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatGrid({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <div className="admin-base-stat-grid" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export type ActiveFilter = { readonly label: string; readonly removeHref: string };

/** The filters in force, each removable in one click, plus a clear-all. Renders nothing when none. */
export function ActiveFilters({
  filters,
  clearHref,
}: {
  readonly filters: readonly ActiveFilter[];
  readonly clearHref: string;
}) {
  if (filters.length === 0) return null;
  return (
    <ul className="admin-base-chips" aria-label="Active filters">
      {filters.map((filter) => (
        <li key={`${filter.label}-${filter.removeHref}`}>
          <Link
            className="admin-base-chip"
            href={filter.removeHref}
            aria-label={`Remove filter ${filter.label}`}
          >
            <span>{filter.label}</span>
            <span aria-hidden="true">×</span>
          </Link>
        </li>
      ))}
      <li>
        <Link className="admin-base-chip admin-base-chip--clear" href={clearHref}>
          Clear all
        </Link>
      </li>
    </ul>
  );
}

/** Shown the instant a navigation starts, while the server renders the next desk. */
export function PageSkeleton() {
  return (
    <main
      className="ds-container admin-base-skeleton"
      id="main"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="admin-base-skeleton__bar admin-base-skeleton__bar--title" />
      <div className="admin-base-skeleton__bar admin-base-skeleton__bar--lede" />
      <div className="admin-base-skeleton__card">
        <div className="admin-base-skeleton__bar admin-base-skeleton__bar--toolbar" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="admin-base-skeleton__row" />
        ))}
      </div>
      <span className="ds-visually-hidden" role="status">
        Loading
      </span>
    </main>
  );
}

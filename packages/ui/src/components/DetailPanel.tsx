/**
 * The record half of a workbench: a labeled panel of read-only facts about one row.
 *
 * The shape it standardizes is the empty case. Every operator surface that grew its own detail
 * markup also grew its own way of saying "nothing recorded" — a bare `—`, a sentence, or an
 * omitted section that leaves the reader unsure whether the field is empty or the query failed.
 * `DetailField` makes absence explicit and identical everywhere, because on a canonical record
 * "no aliases" and "aliases not loaded" are very different facts and must not look the same.
 *
 * Read-only on purpose. Editing is `InlineEdit`, which is a separate primitive because a field
 * being visible and a field being editable are decided by different things — the first by the
 * record, the second by the operator's role.
 */

'use client';

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type DetailPanelProps = {
  readonly title: string;
  readonly children: ReactNode;
  /** Monospace line under the title: ids, timestamps, provenance. */
  readonly meta?: ReactNode;
  /** Trailing controls for the panel as a whole (edit, merge, export). */
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  /** Renders the title as a heading at this level. Defaults to h2. */
  readonly headingLevel?: 2 | 3 | 4;
  readonly className?: string;
};

export function DetailPanel({
  title,
  children,
  meta,
  actions,
  footer,
  headingLevel = 2,
  className,
}: DetailPanelProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <section className={cx('ds-detail', className)} aria-label={title}>
      <header className="ds-detail__header">
        <div className="ds-detail__heading">
          <Heading className="ds-detail__title">{title}</Heading>
          {meta ? <p className="ds-detail__meta">{meta}</p> : null}
        </div>
        {actions ? <div className="ds-detail__actions">{actions}</div> : null}
      </header>
      <dl className="ds-detail__fields">{children}</dl>
      {footer ? <div className="ds-detail__footer">{footer}</div> : null}
    </section>
  );
}

export type DetailFieldProps = {
  readonly label: string;
  readonly children?: ReactNode;
  /**
   * What to show when `children` is empty. Say what is absent ("No aliases recorded"), not just
   * that something is — a reader must be able to tell an empty field from a failed load.
   */
  readonly emptyLabel?: string;
  /** Renders the value in the mono register used for ids, codes, and timestamps. */
  readonly mono?: boolean;
  readonly className?: string;
};

/** True for values that should render as the empty state rather than as content. */
function isEmpty(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false || value === '') return true;
  // An empty array is what `list.map(...)` yields for "no rows", and it renders as nothing.
  return Array.isArray(value) && value.length === 0;
}

export function DetailField({
  label,
  children,
  emptyLabel = 'Not recorded',
  mono,
  className,
}: DetailFieldProps) {
  const empty = isEmpty(children);
  return (
    <div className={cx('ds-detail__field', className)}>
      <dt className="ds-detail__label">{label}</dt>
      <dd className={cx('ds-detail__value', mono && 'ds-detail__value--mono')}>
        {empty ? <span className="ds-detail__empty">{emptyLabel}</span> : children}
      </dd>
    </div>
  );
}

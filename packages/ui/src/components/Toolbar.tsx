/**
 * The control strip above a workbench: search and view controls on the left, actions on the right.
 *
 * This is not a second FilterBar. FilterBar is a fieldset of refinement inputs that submits a
 * query — it owns *what rows match*. Toolbar owns *what you do with the view you have*: the
 * search box, a reset, an export, a role-gated bulk action. They compose (a Toolbar can hold a
 * FilterBar's submit button) but they are not variants of each other.
 *
 * It renders as a `<form>` when given an `action`, so search survives with JavaScript off and
 * leaves a shareable URL — that progressive-enhancement behaviour is why the two admin surfaces
 * that grew their own `story-review__toolbar` did it as a plain GET form, and it is preserved
 * here rather than traded for a click handler.
 */

'use client';

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type ToolbarProps = {
  /** Accessible name for the strip. Required — a bare group of controls announces as nothing. */
  readonly label: string;
  /** Left group: search box, selects, view switches. */
  readonly children?: ReactNode;
  /** Right group: submit, reset, export, bulk actions. */
  readonly actions?: ReactNode;
  /**
   * Renders the strip as a GET/POST form to this path. Omit for a plain (non-submitting) strip.
   * `role="search"` is applied automatically when the form carries a search input.
   */
  readonly action?: string;
  readonly method?: 'get' | 'post';
  /**
   * Params to carry through as hidden inputs so submitting the search box does not silently
   * drop the facets, sort, and page the operator already chose.
   */
  readonly preservedParams?: Readonly<Record<string, string>>;
  readonly role?: 'search' | 'toolbar';
  readonly className?: string;
};

export function Toolbar({
  label,
  children,
  actions,
  action,
  method = 'get',
  preservedParams,
  role,
  className,
}: ToolbarProps) {
  const body = (
    <>
      <div className="ds-toolbar__controls">{children}</div>
      {actions ? <div className="ds-toolbar__actions">{actions}</div> : null}
    </>
  );

  if (!action) {
    return (
      <div
        className={cx('ds-toolbar', className)}
        role={role ?? 'toolbar'}
        aria-label={label}
        aria-orientation="horizontal"
      >
        {body}
      </div>
    );
  }

  return (
    <form
      className={cx('ds-toolbar', className)}
      action={action}
      method={method}
      role={role ?? 'search'}
      aria-label={label}
    >
      {Object.entries(preservedParams ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {body}
    </form>
  );
}

export type ToolbarFieldProps = {
  readonly label: string;
  readonly children: ReactNode;
  /** Hides the label visually while leaving it for screen readers. */
  readonly labelHidden?: boolean;
  readonly className?: string;
};

/** A labelled control inside a Toolbar. The label is never optional, only ever invisible. */
export function ToolbarField({ label, children, labelHidden, className }: ToolbarFieldProps) {
  return (
    <label className={cx('ds-toolbar__field', className)}>
      <span className={cx('ds-toolbar__field-label', labelHidden && 'ds-visually-hidden')}>
        {label}
      </span>
      {children}
    </label>
  );
}

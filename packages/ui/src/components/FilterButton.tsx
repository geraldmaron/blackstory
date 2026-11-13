/**
 * Opens a filter menu: the secondary button with a caret and, when the filter is set, a count
 * badge. It is the trigger only; the menu is the caller's (a native `popover` via
 * `popoverTarget`, or a sheet). `aria-expanded` is the caller's to pass when it tracks the state.
 */

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type FilterButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  /** Number of values set on this filter. Hidden at 0. */
  readonly count?: number;
};

export function FilterButton({
  children,
  count = 0,
  className,
  type = 'button',
  ...rest
}: FilterButtonProps) {
  return (
    <button
      type={type}
      className={cx('ds-button', 'ds-button--secondary', 'ds-filter-button', className)}
      aria-haspopup="true"
      {...rest}
    >
      <span>{children}</span>
      {count > 0 ? (
        <span className="ds-filter-button__count">
          {count}
          <span className="ds-visually-hidden"> selected</span>
        </span>
      ) : null}
      <svg className="ds-filter-button__caret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * A filter value or an active-filter echo. Nothing else: record metadata (Person, 1750s) is plain
 * inline text, and a control that opens a menu is a {@link FilterButton}.
 *
 * 32px visible, 44px hit area, radius 8. Three states: default; selected (inverse fill plus a
 * check glyph, so selection is never color alone); removable (trailing x, accessible name
 * "Remove <label>"). With `href` it renders a link, which is how an echo removes its filter
 * without JavaScript; otherwise a toggle button with `aria-pressed`.
 */

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  readonly children: ReactNode;
  readonly selected?: boolean;
  /** Draws the trailing x and names the action "Remove …". */
  readonly removable?: boolean;
  /** Renders a link instead of a toggle button. */
  readonly href?: string;
  /** Plain-text label used in the removable chip's accessible name. Defaults to `children`. */
  readonly label?: string;
};

function CheckGlyph() {
  return (
    <svg className="ds-chip__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RemoveGlyph() {
  return (
    <svg className="ds-chip__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m4.5 4.5 7 7m0-7-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Chip({
  children,
  selected = false,
  removable = false,
  href,
  label,
  className,
  type = 'button',
  ...rest
}: ChipProps) {
  const classes = cx(
    'ds-chip',
    selected && 'ds-chip--selected',
    removable && 'ds-chip--removable',
    className,
  );
  const name =
    removable && (label ?? (typeof children === 'string' ? children : undefined))
      ? `Remove ${label ?? (children as string)}`
      : undefined;
  const content = (
    <>
      {selected && !removable ? <CheckGlyph /> : null}
      <span className="ds-chip__label">{children}</span>
      {removable ? <RemoveGlyph /> : null}
    </>
  );

  if (href !== undefined) {
    return (
      <a
        className={classes}
        href={href}
        aria-label={name}
        aria-current={selected && !removable ? 'true' : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      aria-pressed={removable ? undefined : selected}
      aria-label={name}
      {...rest}
    >
      {content}
    </button>
  );
}

/**
 * The one button. Three variants: `primary` (copper fill, one per screen), `secondary` (1px
 * control border) and `quiet` (text only). 44px tall, radius 8, Geist 14/600.
 *
 * Renders `<a>` when given `href`, `<button>` otherwise. A framework link (Next's `Link`) takes
 * the same look through {@link buttonClassName}, so there is one recipe and no second component.
 *
 * `compact` is the map chrome's dense control (radius 8, smaller type), kept for the instrument.
 */

import React, { type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'compact';

/** The class list for a button-looking element the kit does not render itself. */
export function buttonClassName(variant: ButtonVariant = 'primary', className?: string): string {
  return cx('ds-button', `ds-button--${variant}`, className);
}

type ButtonOwnProps = {
  readonly variant?: ButtonVariant;
  /** Shows a busy state and blocks the action without collapsing the label. */
  readonly loading?: boolean;
  readonly children: ReactNode;
};

export type ButtonProps =
  | (ButtonOwnProps &
      ButtonHTMLAttributes<HTMLButtonElement> & {
        readonly href?: undefined;
      })
  | (ButtonOwnProps &
      AnchorHTMLAttributes<HTMLAnchorElement> & {
        readonly href: string;
      });

export function Button(props: ButtonProps) {
  const { variant = 'primary', loading = false, className, children, ...rest } = props;
  const classes = buttonClassName(variant, className);

  if (typeof rest.href === 'string') {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} aria-busy={loading || undefined} {...anchor}>
        {children}
      </a>
    );
  }

  const { type = 'button', disabled, ...button } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...button}
    >
      {children}
    </button>
  );
}

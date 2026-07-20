/**
 * Primary/secondary button primitives using semantic native button elements.
 */

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: 'primary' | 'secondary';
  readonly children: ReactNode;
};

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx('ds-button', `ds-button--${variant}`, className)} {...rest}>
      {children}
    </button>
  );
}

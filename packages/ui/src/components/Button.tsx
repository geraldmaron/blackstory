/**
 * Primary/secondary button primitives using semantic native button elements.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx.js';

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
    <button type={type} className={cx('bb-button', `bb-button--${variant}`, className)} {...rest}>
      {children}
    </button>
  );
}

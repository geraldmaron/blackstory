/**
 * A date, decade or count set huge as a graphic element (Schibsted at the numeral weight, 72-200px, tight
 * tracking). `accent` is copper on paper and ink grounds and ink on copper and sand; `soft` is sand
 * on ink and steps to copper on paper, where sand fails 3:1; `ink` follows the ground's ink.
 *
 * When the same value is stated in text nearby, pass `decorative` so a screen reader does not
 * hear it twice. Otherwise it is read as written.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type DisplayNumeralProps = HTMLAttributes<HTMLElement> & {
  readonly children: ReactNode;
  readonly tone?: 'accent' | 'soft' | 'ink';
  /** `numeral` is the full 72-200px step; `title` is the page-title step (56-120px). */
  readonly size?: 'numeral' | 'title';
  readonly as?: 'span' | 'p' | 'div' | 'strong';
  readonly decorative?: boolean;
};

export function DisplayNumeral({
  children,
  tone = 'accent',
  size = 'numeral',
  as: Component = 'span',
  decorative = false,
  className,
  ...rest
}: DisplayNumeralProps) {
  return (
    <Component
      className={cx(
        'ds-numeral',
        tone !== 'accent' && `ds-numeral--${tone}`,
        size === 'title' && 'ds-numeral--title',
        className,
      )}
      aria-hidden={decorative || undefined}
      {...rest}
    >
      {children}
    </Component>
  );
}

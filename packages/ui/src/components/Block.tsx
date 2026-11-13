/**
 * A full-bleed color band that breaks a page into chapters: copper, sand, paper or ink, used at
 * full strength. It sets `data-ground`, so type and controls inside it take that ground's colors
 * (ink on copper and sand, ink on paper, paper on ink). Put a `.ds-wrap` inside for the measure.
 *
 * `wipe` lets the band wipe in once as it scrolls into view (scroll-linked, skipped under
 * reduced motion and where the browser cannot tie animation to scroll).
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type BlockTone = 'copper' | 'sand' | 'paper' | 'ink';

export type BlockProps = HTMLAttributes<HTMLElement> & {
  readonly tone: BlockTone;
  readonly as?: 'section' | 'div' | 'footer' | 'aside' | 'header';
  readonly wipe?: boolean;
  readonly children: ReactNode;
};

export function Block({
  tone,
  as: Component = 'section',
  wipe = false,
  className,
  children,
  ...rest
}: BlockProps) {
  return (
    <Component
      className={cx('ds-block', `ds-block--${tone}`, wipe && 'ds-block--wipe', className)}
      data-ground={tone}
      {...rest}
    >
      {children}
    </Component>
  );
}

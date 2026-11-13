/**
 * Navigation between places: plain labels, 44px hit area, the current one in ink with a 2px
 * copper bar under it and `aria-current="page"`. For options on the same data use
 * {@link Segmented}.
 *
 * `linkAs` lets a framework link (Next's `Link`) render the anchors. A tab with `onClick` and no
 * `href` renders a button, for a destination that is reached by restoring state rather than by
 * navigating.
 */

import React, { type ElementType, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type TabItem = {
  readonly label: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly current?: boolean;
  /** Accessible name when it must say more than the visible label. Starts with the label. */
  readonly ariaLabel?: string;
};

export type TabsProps = {
  /** The nav landmark's name. */
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly linkAs?: ElementType;
  readonly className?: string;
};

export function Tabs({ label, items, linkAs: LinkAs = 'a', className }: TabsProps) {
  return (
    <nav className={cx('ds-tabs', className)} aria-label={label}>
      {items.map((item, index) => {
        const current = item.current ? 'page' : undefined;
        if (item.href === undefined) {
          return (
            <button
              key={index}
              type="button"
              className="ds-tabs__tab"
              aria-current={current}
              aria-label={item.ariaLabel}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          );
        }
        return (
          <LinkAs
            key={item.href}
            className="ds-tabs__tab"
            href={item.href}
            aria-current={current}
            aria-label={item.ariaLabel}
            onClick={item.onClick}
          >
            {item.label}
          </LinkAs>
        );
      })}
    </nav>
  );
}

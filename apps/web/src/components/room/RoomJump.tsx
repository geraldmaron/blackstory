/**
 * Shared section jump for standalone rooms. About, Rooms, Methodology, FAQ and Sources
 * each invented a different table of contents (bullet list, chips, sticky rail). One
 * chip row with a glyph, sticky under the command bar, tracks the visible section.
 *
 * Links work with JavaScript off. Hydration only adds `aria-current`.
 */
'use client';

import React, { useEffect, useState } from 'react';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx } from '@repo/ui';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type RoomJumpSection = {
  readonly id: string;
  readonly label: string;
  readonly icon: DestinationIconId;
};

export type RoomJumpProps = {
  readonly sections: readonly RoomJumpSection[];
  readonly label?: string;
  readonly className?: string;
};

export function RoomJump({ sections, label = 'Sections of this page', className }: RoomJumpProps) {
  const [current, setCurrent] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        let best: string | undefined;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const [id, top] of visible) {
          if (top < bestTop) {
            best = id;
            bestTop = top;
          }
        }
        if (best) setCurrent(best);
      },
      { rootMargin: '-28% 0px -58% 0px', threshold: 0 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className={cx('ds-room-jump', className)} aria-label={label}>
      <ol className="ds-room-jump__list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className="ds-room-jump__link"
              href={`#${section.id}`}
              aria-current={current === section.id ? 'location' : undefined}
            >
              <DestinationIcon id={section.icon} />
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

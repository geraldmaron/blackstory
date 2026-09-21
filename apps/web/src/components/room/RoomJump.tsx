/**
 * Shared section jump for standalone rooms. About, Rooms, Methodology, FAQ and Sources
 * each invented a different table of contents (bullet list, chips, sticky rail). One
 * chip row with a glyph, sticky under the command bar, tracks the visible section.
 *
 * Links work with JavaScript off. Hydration adds `aria-current`, keeps the current pill inside
 * the row when the row scrolls, and marks which side of the row has more (`data-more`) so the
 * stylesheet can fade that edge.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  const listRef = useRef<HTMLOListElement>(null);

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

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sync = () => {
      const start = list.scrollLeft > 1;
      const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      const more = start && end ? 'both' : start ? 'start' : end ? 'end' : undefined;
      if (more) list.dataset.more = more;
      else delete list.dataset.more;
    };
    sync();
    list.addEventListener('scroll', sync, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(sync);
    resize?.observe(list);
    return () => {
      list.removeEventListener('scroll', sync);
      resize?.disconnect();
    };
  }, [sections]);

  // Moves the row, never the page: `scrollIntoView` would also scroll the document vertically.
  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!list || !pill) return;
    const listBox = list.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    if (pillBox.left >= listBox.left && pillBox.right <= listBox.right) return;
    // Not animated: the row sits under the reader's eye line while they scroll the page, and a
    // second motion there competes with the one they started.
    list.scrollLeft += pillBox.left - listBox.left - (listBox.width - pillBox.width) / 2;
  }, [current]);

  return (
    <nav className={cx('ds-room-jump', className)} aria-label={label}>
      <ol className="ds-room-jump__list" ref={listRef}>
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

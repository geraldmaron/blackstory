/**
 * The section rail for `/data`: one sticky row of anchors that names where the reader is.
 *
 * The anchors are the whole contract. They work as plain links with JavaScript off, and the only
 * thing hydration adds is `aria-current`, set from an IntersectionObserver so the rail tracks the
 * scroll rather than the last click. It is the reference-ledger equivalent of a running head.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { cx } from '@repo/ui';

void React;

export type DataPageNavSection = {
  readonly id: string;
  readonly label: string;
};

export type DataPageNavProps = {
  readonly sections: readonly DataPageNavSection[];
  readonly className?: string;
};

export function DataPageNav({ sections, className }: DataPageNavProps) {
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
        // The current section is the visible one closest to the top of the viewport.
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
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className={cx('ds-data-nav', className)} aria-label="Sections of this page">
      <ol className="ds-data-nav__list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className="ds-data-nav__link"
              href={`#${section.id}`}
              aria-current={current === section.id ? 'location' : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

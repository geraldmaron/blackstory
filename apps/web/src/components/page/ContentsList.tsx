/**
 * A page's contents: a plain text list of its sections. On a read-width page at desktop widths it
 * stays in view in the left margin (page-kit.css); below that it is not drawn, because the section
 * headings already are the contents.
 *
 * Links work with JavaScript off. Hydration adds `aria-current` to the section in view.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { cx } from '@repo/ui';

void React;

export type ContentsEntry = {
  readonly id: string;
  readonly label: string;
};

export type ContentsListProps = {
  readonly sections: readonly ContentsEntry[];
  readonly label?: string;
  readonly className?: string;
};

export function ContentsList({ sections, label = 'On this page', className }: ContentsListProps) {
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
    <nav className={cx('ds-doc-toc', className)} aria-label={label}>
      <ol className="ds-doc-toc__list">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className="ds-doc-toc__link"
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

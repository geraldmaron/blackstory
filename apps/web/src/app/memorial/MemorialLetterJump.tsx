/**
 * Memorial letter jump. Plain anchors with JavaScript off; hydration only adds
 * `aria-current` so a reader deep in a 1,600-name list can tell which letter they are in.
 *
 * P-01: this is the accessible list rail, not the handwritten wall.
 */
'use client';

import React, { useEffect, useState } from 'react';

void React;

export function MemorialLetterJump({ letters }: { readonly letters: readonly string[] }) {
  const [current, setCurrent] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = letters
      .map((letter) => document.getElementById(groupId(letter)))
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
  }, [letters]);

  return (
    <nav className="ds-memorial__jump" aria-label="Jump to a letter">
      {letters.map((letter) => {
        const id = groupId(letter);
        return (
          <a
            className="ds-memorial__jump-link"
            key={letter}
            href={`#${id}`}
            aria-current={current === id ? 'location' : undefined}
          >
            {letter}
          </a>
        );
      })}
    </nav>
  );
}

function groupId(letter: string) {
  return `memorial-names-${letter === '#' ? 'other' : letter}`;
}

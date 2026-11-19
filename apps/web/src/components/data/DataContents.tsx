'use client';

/**
 * The sticky contents list beside the figures on desktop: sections, and the figures under each by
 * a short name. The one in view is marked in ink with a bar, never by color alone. Plain anchor
 * links, so it works before hydration; the marker is the only thing the script adds.
 */
import React, { useEffect, useState } from 'react';

void React;

export type ContentsGroup = {
  readonly id: string;
  readonly label: string;
  readonly figures: readonly { readonly id: string; readonly label: string }[];
};

export function DataContents({
  groups,
  notes,
}: {
  readonly groups: readonly ContentsGroup[];
  /** Small print under the list: the as-of dates. */
  readonly notes: readonly string[];
}) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const ids = groups.flatMap((group) => [group.id, ...group.figures.map((figure) => figure.id)]);
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // The topmost figure in the reading band wins; a section only when no figure is in it.
        const ranked = [...visible.entries()].sort((a, b) => a[1] - b[1]);
        const figure = ranked.find(([id]) => !groups.some((group) => group.id === id));
        const next = figure?.[0] ?? ranked[0]?.[0];
        if (next) setCurrent(next);
      },
      { rootMargin: '-20% 0px -55% 0px' },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [groups]);

  const currentGroup = groups.find(
    (group) => group.id === current || group.figures.some((figure) => figure.id === current),
  )?.id;

  return (
    <nav className="ds-data-contents" aria-label="On this page">
      <ol className="ds-data-contents__list">
        {groups.map((group) => (
          <li key={group.id}>
            <a
              className="ds-data-contents__section"
              href={`#${group.id}`}
              aria-current={group.id === currentGroup ? 'true' : undefined}
            >
              {group.label}
            </a>
            {group.figures.length > 0 ? (
              <ol className="ds-data-contents__figures">
                {group.figures.map((figure) => (
                  <li key={figure.id}>
                    <a
                      className="ds-data-contents__figure"
                      href={`#${figure.id}`}
                      aria-current={figure.id === current ? 'true' : undefined}
                    >
                      {figure.label}
                    </a>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
      {notes.length > 0 ? (
        <p className="ds-data-contents__notes">
          {notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </p>
      ) : null}
    </nav>
  );
}

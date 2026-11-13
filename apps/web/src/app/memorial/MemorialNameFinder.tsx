/**
 * The memorial list's finder: a "Find a name" field and the letter jump.
 *
 * The names themselves are server-rendered by MemorialSections and stay in the HTML. Typing here
 * hides the entries that do not match, in place; the letter jump is plain anchors that work with
 * JavaScript off, and hydration adds `aria-current` for the letter being read.
 *
 * P-01: this is the accessible list, not the handwritten wall.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { memorialNameMatches } from './memorial-name-find';
import { memorialGroupId } from './memorial-group-id';

void React;

export function MemorialNameFinder({ letters }: { readonly letters: readonly string[] }) {
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<string | undefined>(undefined);
  /** Matches per letter while a query is active; undefined when the whole list shows. */
  const [matches, setMatches] = useState<Readonly<Record<string, number>> | undefined>(undefined);

  // Filter in place: the list is server HTML, so this toggles `hidden` rather than re-rendering it.
  useEffect(() => {
    const active = query.trim().length > 0;
    const counts: Record<string, number> = {};
    for (const letter of letters) {
      const section = document.getElementById(memorialGroupId(letter));
      if (!section) continue;
      let shown = 0;
      for (const entry of section.querySelectorAll<HTMLElement>('.ds-memorial-index__entry')) {
        const name = entry.querySelector('.ds-memorial-index__name')?.textContent ?? '';
        const match = !active || memorialNameMatches(name, query);
        entry.hidden = !match;
        if (match) shown += 1;
      }
      section.hidden = shown === 0;
      counts[letter] = shown;
    }
    const empty = document.getElementById('memorial-names-empty');
    if (empty) empty.hidden = !active || Object.values(counts).some((count) => count > 0);
    setMatches(active ? counts : undefined);
  }, [letters, query]);

  // The letter whose section crosses a line a third of the way down the viewport is "current".
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        }
      },
      { rootMargin: '-33% 0px -66% 0px', threshold: 0 },
    );
    for (const letter of letters) {
      const section = document.getElementById(memorialGroupId(letter));
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [letters]);

  // On a phone the letters are one sideways-scrolling row: keep the current one inside it.
  useEffect(() => {
    if (!current) return;
    const link = document.querySelector<HTMLElement>(
      `.ds-memorial-index__jump-link[href="#${current}"]`,
    );
    const row = link?.closest<HTMLElement>('.ds-memorial-index__jump');
    if (!link || !row || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  }, [current]);

  const total = matches ? Object.values(matches).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="ds-memorial-index__finder">
      <div className="ds-memorial-index__find">
        <label className="ds-memorial-index__find-label" htmlFor="memorial-find">
          Find a name
        </label>
        <input
          className="ds-memorial-index__find-input"
          id="memorial-find"
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="ds-memorial-index__find-status" role="status" aria-live="polite">
          {matches === undefined
            ? ''
            : total === 0
              ? 'No names match'
              : total === 1
                ? '1 name matches'
                : `${total} names match`}
        </p>
      </div>

      <nav className="ds-memorial-index__jump" aria-label="Jump to a letter">
        <ul className="ds-memorial-index__jump-list">
          {letters.map((letter) => {
            const id = memorialGroupId(letter);
            // While filtering, a letter with no match has nowhere to go, so it is not a link.
            const empty = matches !== undefined && !matches[letter];
            return (
              <li key={letter}>
                {empty ? (
                  <span className="ds-memorial-index__jump-link" aria-disabled="true">
                    {letter}
                  </span>
                ) : (
                  <a
                    className="ds-memorial-index__jump-link"
                    href={`#${id}`}
                    aria-current={current === id ? 'location' : undefined}
                  >
                    {letter}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

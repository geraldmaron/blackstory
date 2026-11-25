/**
 * Client-side docs search over the prebuilt content index.
 */
'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { SearchHit } from '@/lib/content';

type Props = {
  index: SearchHit[];
};

export function DocsSearch({ index }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      return [];
    }
    return index
      .filter((item) => {
        const hay = `${item.title} ${item.description} ${item.excerpt}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [index, query]);

  return (
    <div
      className="search-slot"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          // Focus first: the input's onFocus reopens, and the close below must win.
          inputRef.current?.focus();
          setOpen(false);
        }
      }}
    >
      <div className="search-wrap">
        <label className="visually-hidden" htmlFor="docs-search">
          Search docs
        </label>
        <input
          id="docs-search"
          ref={inputRef}
          type="search"
          placeholder="Search docs…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </div>
      <p className="visually-hidden" role="status">
        {query.trim().length < 2
          ? ''
          : `${hits.length} ${hits.length === 1 ? 'result' : 'results'}`}
      </p>
      {open && hits.length > 0 ? (
        // Safari does not focus a link on click, so keep focus in the input
        // or the blur above unmounts the link before its click lands.
        <ul
          className="search-results"
          aria-label="Search results"
          onMouseDown={(event) => event.preventDefault()}
        >
          {hits.map((hit) => (
            <li key={hit.slug}>
              <Link href={hit.url} onClick={() => setOpen(false)}>
                <strong>{hit.title}</strong>
                <span>{hit.description || hit.excerpt}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

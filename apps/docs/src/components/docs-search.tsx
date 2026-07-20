/**
 * Client-side docs search over the prebuilt content index.
 */
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SearchHit } from '@/lib/content';

type Props = {
  index: SearchHit[];
};

export function DocsSearch({ index }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

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
    <div className="search-slot">
      <div className="search-wrap">
        <label className="visually-hidden" htmlFor="docs-search">
          Search docs
        </label>
        <input
          id="docs-search"
          type="search"
          placeholder="Search docs…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          autoComplete="off"
        />
      </div>
      {open && hits.length > 0 ? (
        <div className="search-results" role="listbox" aria-label="Search results">
          {hits.map((hit) => (
            <Link key={hit.slug} href={hit.url} onClick={() => setOpen(false)}>
              <strong>{hit.title}</strong>
              <span>{hit.description || hit.excerpt}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

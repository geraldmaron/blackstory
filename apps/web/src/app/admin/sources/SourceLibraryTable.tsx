/**
 * The source library table body — split out from `page.tsx` so it can be rendered in a test
 * with realistic rows and no Postgres connection.
 */
import React from 'react';
import Link from 'next/link';
import type { SourceLibraryListItem } from '../../../admin/sources/sources-store';
import { formatPublisherKind, formatTier } from './source-library-labels';

// Defensive: apps/web SSR tests may classic-transform this file's TSX source.
void React;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function profileStatus(row: SourceLibraryListItem): string {
  return row.profileReviewedAt ? `Reviewed ${formatWhen(row.profileReviewedAt)}` : 'No profile';
}

export type SourceLibrarySortHrefs = {
  readonly entities: string;
  readonly name: string;
};

export function SourceLibraryTable({
  rows,
  sort,
  sortHrefs,
}: {
  readonly rows: readonly SourceLibraryListItem[];
  readonly sort: 'entities' | 'name';
  readonly sortHrefs: SourceLibrarySortHrefs;
}) {
  if (rows.length === 0) {
    return <p className="ds-sans">No publishers matched.</p>;
  }

  return (
    <div className="story-review__table-wrap">
      <table className="story-review__table">
        <caption className="ds-visually-hidden">
          Source library publishers with kind, tier, and published counts
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <a href={sortHrefs.name} aria-current={sort === 'name' ? 'true' : undefined}>
                Name
              </a>
            </th>
            <th scope="col">Kind</th>
            <th scope="col">Tier</th>
            <th scope="col">
              <a href={sortHrefs.entities} aria-current={sort === 'entities' ? 'true' : undefined}>
                Published entities
              </a>
            </th>
            <th scope="col">Published claims</th>
            <th scope="col">Canonical entities</th>
            <th scope="col">Profile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.organizationId}>
              <td>
                <Link
                  href={`/admin/sources/${encodeURIComponent(row.organizationId)}`}
                  className="story-review__row-title"
                >
                  {row.name}
                </Link>
                <p className="story-review__row-meta ds-mono">{row.organizationId}</p>
              </td>
              <td>{formatPublisherKind(row.publisherKind)}</td>
              <td>{formatTier(row.tier)}</td>
              <td className="ds-mono">{row.publishedEntities.toLocaleString()}</td>
              <td className="ds-mono">{row.publishedClaims.toLocaleString()}</td>
              <td className="ds-mono">{row.canonicalEntities.toLocaleString()}</td>
              <td>{profileStatus(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="story-review__queue-foot ds-mono">{rows.length} publishers</p>
    </div>
  );
}

/**
 * The paginated entity list on a source-library detail page — split out so it can be rendered
 * in a test with realistic rows and no Postgres connection. Links go to the public record page
 * through `/entity/{id}`, the universal address that 308s to the record's real family (place,
 * invention, or the entity room itself) — see `app/entity/[id]/page.tsx`.
 */
import React from 'react';
import Link from 'next/link';
import type { SourceEntityListItem } from '../../../../admin/sources/sources-store';

// Defensive: apps/web SSR tests may classic-transform this file's TSX source.
void React;

export function SourceEntityTable({ rows }: { readonly rows: readonly SourceEntityListItem[] }) {
  if (rows.length === 0) {
    return <p className="ds-sans">No published entities cite this publisher.</p>;
  }

  return (
    <div className="story-review__table-wrap">
      <table className="story-review__table">
        <caption className="ds-visually-hidden">
          Published entities citing this publisher, with claim count and a sample citation
        </caption>
        <thead>
          <tr>
            <th scope="col">Entity</th>
            <th scope="col">Kind</th>
            <th scope="col">Claims</th>
            <th scope="col">Sample citation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entityId}>
              <td>
                <Link href={`/entity/${encodeURIComponent(row.entityId)}`}>
                  {row.entityDisplayName}
                </Link>
                <p className="story-review__row-meta ds-mono">{row.entityId}</p>
              </td>
              <td>{row.entityKind}</td>
              <td className="ds-mono">{row.claimCount.toLocaleString()}</td>
              <td>
                {row.sampleCitationHref ? (
                  <a href={row.sampleCitationHref} rel="noopener noreferrer" target="_blank">
                    Sample
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

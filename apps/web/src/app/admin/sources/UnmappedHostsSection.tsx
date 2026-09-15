/**
 * "Hosts not tied to a publisher" — citation hosts with published reach but no
 * `source_library` row of their own. Split out for the same reason as `SourceLibraryTable`:
 * it renders with plain rows in a test, no Postgres involved.
 */
import React from 'react';
import type { UnmappedHostItem } from '../../../admin/sources/sources-store';

// Defensive: apps/web SSR tests may classic-transform this file's TSX source.
void React;

export function UnmappedHostsSection({ rows }: { readonly rows: readonly UnmappedHostItem[] }) {
  return (
    <section className="story-review__queue" aria-label="Hosts not tied to a publisher">
      <h2 className="ds-section__title">Hosts not tied to a publisher</h2>
      <p className="ds-sans">
        Citation hosts published without a matching source-library organization. Map these to a
        publisher, or record that none applies.
      </p>
      {rows.length === 0 ? (
        <p className="ds-sans">Every published citation host maps to a publisher.</p>
      ) : (
        <div className="story-review__table-wrap">
          <table className="story-review__table">
            <caption className="ds-visually-hidden">
              Unmapped citation hosts with published entity and claim counts
            </caption>
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col">Published entities</th>
                <th scope="col">Published claims</th>
                <th scope="col">Sample citation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.host}>
                  <td className="ds-mono">{row.host}</td>
                  <td className="ds-mono">{row.publishedEntities.toLocaleString()}</td>
                  <td className="ds-mono">{row.publishedClaims.toLocaleString()}</td>
                  <td>
                    {row.sampleHref ? (
                      <a href={row.sampleHref} rel="noopener noreferrer" target="_blank">
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
          <p className="story-review__queue-foot ds-mono">{rows.length} unmapped hosts</p>
        </div>
      )}
    </section>
  );
}

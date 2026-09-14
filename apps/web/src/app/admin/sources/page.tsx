/**
 * Source organization registry browser — read-only list of registered organizations.
 *
 * Server component (repo-gyq6.9): the organization list is read in the request instead of after a hydrate and a token refresh.
 *
 * The matching /admin/api route stays for callers outside this page. The Refresh button went
 * with the client state: a server-rendered page IS the refresh.
 */
import type { Metadata } from 'next';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { listSourceOrganizations } from '../../../admin/sources/sources-store';

export const metadata: Metadata = {
  title: 'Sources',
  description: 'Source organizations the archive reads from.',
};

/** Operational state is read at request time, never served from a cache. */
export const dynamic = 'force-dynamic';

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function SourcesPage() {
  const outcome = await readPostgresOrDegrade(
    () => listSourceOrganizations(100),
    'source organizations',
  );
  const rows = outcome.status === 'ok' ? outcome.value : [];
  const degradedReason = outcome.status === 'degraded' ? outcome.reason : undefined;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Evidence registry</p>
          <h1 className="ds-page__title">Source organizations</h1>
          <p className="ds-page__lede">
            Registered organizations backing evidence sources and adapter policies. Browse
            provenance metadata here; entity promotion and publication stay in catalog and release
            workflows.
          </p>
        </div>
      </header>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          Sources are unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial list. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Source organizations">
        {rows.length === 0 && !degradedReason ? (
          <p className="ds-sans">No source organizations found.</p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Homepage</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="story-review__row-title">{row.name}</span>
                      <p className="story-review__row-meta ds-mono">{row.id}</p>
                      {row.notes ? <p className="ds-sans">{row.notes}</p> : null}
                    </td>
                    <td>
                      {row.homepageUrl ? (
                        <a href={row.homepageUrl} className="ds-mono">
                          {row.homepageUrl}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="ds-mono">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} organizations</p>
          </div>
        )}
      </section>
    </main>
  );
}

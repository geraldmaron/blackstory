/**
 * Source organization registry browser — read-only list of registered organizations.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import type { SourceOrganizationListItem } from '../../sources/sources-store';

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

export default function SourcesPage() {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly SourceOrganizationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        return;
      }
      const response = await fetch('/api/sources?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        items?: SourceOrganizationListItem[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? `Load failed (${response.status})`);
      }
      setRows(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

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
        <button
          type="button"
          className="ds-button ds-button--secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error ? (
        <p className="story-review__alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="story-review__queue" aria-label="Source organizations">
        {loading && rows.length === 0 ? (
          <p className="ds-mono">Loading organizations…</p>
        ) : rows.length === 0 ? (
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

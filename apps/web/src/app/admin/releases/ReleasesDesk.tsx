/**
 * The release table of /admin/releases: a read-only record of manifests and which one is live.
 *
 * The list is read in the server request and arrives as props; this component fetches nothing and
 * holds no state. Nothing here changes a release or the public pointer. Published records are
 * updated in place by the incremental publisher, so the active release can change content without
 * a new release appearing in this table.
 */
import type {
  ActiveReleasePointer,
  PublicationReleaseListItem,
} from '../../../admin/releases/releases-store';

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type ReleasesDeskProps = {
  readonly rows: readonly PublicationReleaseListItem[];
  readonly activeRelease: ActiveReleasePointer | null;
};

export function ReleasesDesk({ rows, activeRelease }: ReleasesDeskProps) {
  return (
    <>
      <section className="story-review__queue" aria-label="Publication releases">
        {rows.length === 0 ? (
          <p className="ds-sans">No publication releases found.</p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <thead>
                <tr>
                  <th scope="col">Release</th>
                  <th scope="col">Status</th>
                  <th scope="col">Search index</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isActive = activeRelease?.releaseId === row.id;
                  return (
                    <tr key={row.id} className={isActive ? 'is-selected' : undefined}>
                      <td>
                        <span className="story-review__row-title">{row.id}</span>
                        <p className="story-review__row-meta ds-mono">
                          by {row.createdBy}
                          {isActive ? ' · active pointer' : ''}
                        </p>
                      </td>
                      <td>
                        <span className={`story-review__badge story-review__badge--${row.status}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="ds-mono">{row.searchIndexVersion}</td>
                      <td className="ds-mono">{formatWhen(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="story-review__queue-foot ds-mono">{rows.length} releases</p>
          </div>
        )}
      </section>
    </>
  );
}

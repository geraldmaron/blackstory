/**
 * Submissions queue — every row in bb_submissions.intake_items, not only the story-packet slice
 * `/admin/stories/review` already covers.
 *
 * repo-gyq6.10 (D2): of 2,175 intake_items rows, only a handful shaped like a story packet
 * (`payload->>'proposalKind' = 'story_packet'`) were reachable from any admin surface — 2,060 of
 * them sit quarantined today with no other way to see or decide them. This page is the general
 * reader: server-rendered, filtered and paginated in SQL before the first byte, following the
 * same pattern `/admin/catalog` established for the entity workbench (repo-gyq6.9).
 */
import Link from 'next/link';
import { FacetRail, Pagination, Toolbar, ToolbarField, type FacetGroup } from '@repo/ui';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import {
  queryIntakeItemFacets,
  queryIntakeItemPage,
  type FacetBucket,
  type SubmissionQuery,
} from '../../../admin/lib/postgres-submissions';
import {
  hasActiveSubmissionFilters,
  parseSubmissionQuery,
  serializeSubmissionQuery,
  submissionQueryHref,
  toggleSubmissionFacetHref,
} from '../../../admin/lib/submission-query-params';

const BASE_PATH = '/admin/submissions';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function toFacetGroup(
  id: string,
  label: string,
  key: 'statuses' | 'kinds',
  buckets: readonly FacetBucket[],
  query: SubmissionQuery,
): FacetGroup {
  const active = query[key] ?? [];
  return {
    id,
    label,
    options: buckets.map((bucket) => ({
      value: bucket.value,
      label: titleCase(bucket.value),
      count: bucket.count,
      href: toggleSubmissionFacetHref(BASE_PATH, query, key, bucket.value),
      active: active.includes(bucket.value),
    })),
  };
}

function formatWhen(iso: string): string {
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

export default async function SubmissionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSubmissionQuery(await searchParams);

  const [pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(() => queryIntakeItemPage(query), 'submissions'),
    readPostgresOrDegrade(() => queryIntakeItemFacets(query), 'submission facets'),
  ]);

  const degradedReason =
    pageOutcome.status === 'degraded'
      ? pageOutcome.reason
      : facetsOutcome.status === 'degraded'
        ? facetsOutcome.reason
        : undefined;

  const page =
    pageOutcome.status === 'ok'
      ? pageOutcome.value
      : { rows: [], total: 0, page: 1, pageCount: 1, pageSize: query.pageSize ?? 50 };
  const facets = facetsOutcome.status === 'ok' ? facetsOutcome.value : { status: [], kind: [] };

  const facetGroups: readonly FacetGroup[] = [
    toFacetGroup('status', 'Status', 'statuses', facets.status, query),
    toFacetGroup('kind', 'Kind', 'kinds', facets.kind, query),
  ];

  const filtersActive = hasActiveSubmissionFilters(query);

  const { search: _omitSearch, ...queryWithoutSearch } = query;
  const preservedParams = new URLSearchParams(
    serializeSubmissionQuery({ ...queryWithoutSearch, page: 1 }),
  );

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-page__header">
        <p className="ds-page__eyebrow">Intake</p>
        <h1 className="ds-page__title">Submissions</h1>
        <p className="ds-page__lede">
          Every row in the raw submissions queue — public leads, discovery survivors, and every
          other proposal shape, not only staged story packets. Deciding here only changes{' '}
          <code>intake_items.status</code>; promoting opens a research case, it never publishes
          anything.
        </p>
        <p className="story-review__notice">
          <Link href="/admin/stories/review">Story packet review</Link>
          {' · '}
          <Link href="/admin/cases">Research cases</Link>
        </p>
      </header>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The submissions database did not answer, so this page is showing nothing rather than
          waiting. Reload to retry. <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <div className="ds-workbench">
        <div className="ds-workbench__rail">
          <FacetRail groups={facetGroups} clearHref={BASE_PATH} hasActiveFilters={filtersActive} />
        </div>

        <div className="ds-workbench__main">
          <Toolbar
            label="Search submissions"
            action={BASE_PATH}
            preservedParams={Object.fromEntries(preservedParams.entries())}
            actions={
              <>
                <button type="submit" className="ds-button ds-button--secondary">
                  Search
                </button>
                {filtersActive ? (
                  <a className="ds-button ds-button--secondary" href={BASE_PATH}>
                    Reset
                  </a>
                ) : null}
              </>
            }
          >
            <ToolbarField label="Search">
              <input
                type="search"
                name="q"
                defaultValue={query.search ?? ''}
                placeholder="Id, source URL, or payload text…"
              />
            </ToolbarField>
          </Toolbar>

          <section className="story-review__queue" aria-label="Submissions">
            {page.rows.length === 0 ? (
              <p className="ds-sans">
                No submissions match this view.{' '}
                {query.statuses?.length === 1 && query.statuses[0] === 'quarantined'
                  ? 'The quarantined queue is empty right now.'
                  : 'Try clearing a filter.'}
              </p>
            ) : (
              <div className="story-review__table-wrap">
                <table className="story-review__table">
                  <caption className="ds-visually-hidden">
                    Submissions with status, kind, source, and intake time
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Submission</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Status</th>
                      <th scope="col">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className="story-review__row-title" href={`${BASE_PATH}/${row.id}`}>
                            {row.title}
                          </Link>
                          <p className="story-review__row-meta ds-mono">
                            {row.id}
                            {row.sourceUrl ? ` · ${row.sourceUrl}` : ''}
                          </p>
                        </td>
                        <td>{row.kind ? titleCase(row.kind) : 'Unspecified'}</td>
                        <td>
                          <span className="story-review__badge">{titleCase(row.status)}</span>
                        </td>
                        <td className="ds-mono">{formatWhen(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="story-review__queue-foot ds-mono">{page.total} total</p>
              </div>
            )}
          </section>

          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            itemLabel="submissions"
            hrefForPage={(target: number) =>
              submissionQueryHref(BASE_PATH, query, { page: target })
            }
          />
        </div>
      </div>
    </main>
  );
}

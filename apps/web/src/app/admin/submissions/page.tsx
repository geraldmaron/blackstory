/**
 * Server-rendered queue for all submission kinds, filtered and paginated in SQL. Story-specific
 * review remains available in the story workbench.
 */
import { FacetRail, Pagination, type FacetGroup } from '@repo/ui';
import { DeskToolbar } from '../../../admin/design-system/DeskToolbar';
import {
  ActiveFilters,
  DeskTitleBar,
  Panel,
  type ActiveFilter,
} from '../../../admin/design-system/ui';
import { SubmissionsTable } from './SubmissionsTable';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import {
  queryIntakeItemFacets,
  queryIntakeItemPage,
  type FacetBucket,
  type SubmissionQuery,
  type SubmissionSortKey,
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

  const {
    search: _omitSearch,
    sort: _omitSort,
    direction: _omitDir,
    ...queryWithoutSearch
  } = query;
  const preserved = Object.fromEntries(
    new URLSearchParams(serializeSubmissionQuery({ ...queryWithoutSearch, page: 1 })),
  );
  const isDefaultStatus = query.statuses?.length === 1 && query.statuses[0] === 'quarantined';
  const active: ActiveFilter[] = [
    ...(query.search
      ? [
          {
            label: `“${query.search}”`,
            removeHref: submissionQueryHref(BASE_PATH, query, { search: '' }),
          },
        ]
      : []),
    ...(isDefaultStatus ? [] : (query.statuses ?? [])).map((value) => ({
      label: `Status: ${titleCase(value)}`,
      removeHref: toggleSubmissionFacetHref(BASE_PATH, query, 'statuses', value),
    })),
    ...(query.kinds ?? []).map((value) => ({
      label: `Kind: ${titleCase(value)}`,
      removeHref: toggleSubmissionFacetHref(BASE_PATH, query, 'kinds', value),
    })),
  ];
  const sortHref = (key: SubmissionSortKey): string => {
    const direction =
      query.sort === key
        ? query.direction === 'asc'
          ? 'desc'
          : 'asc'
        : key === 'created'
          ? 'desc'
          : 'asc';
    return submissionQueryHref(BASE_PATH, query, { sort: key, direction });
  };

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Intake"
        title="Submissions"
        meta={<span>{page.total.toLocaleString()} in this view</span>}
        description="Public corrections, appeals, abuse reports, leads and research proposals. Promote an item to open a research case. Decisions update receipt status; they never publish."
        actions={
          <>
            <a className="ds-button ds-button--secondary" href="/admin/stories/review">
              Story packets
            </a>
            <a className="ds-button ds-button--secondary" href="/admin/cases">
              Research cases
            </a>
          </>
        }
      />

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
          <DeskToolbar
            label="Search submissions"
            action={BASE_PATH}
            preserved={preserved}
            search={{ value: query.search ?? '', placeholder: 'Id, source URL, or payload text…' }}
            sort={{
              value: query.sort ?? 'created',
              direction: query.direction ?? 'desc',
              options: [
                { value: 'created', label: 'Submitted' },
                { value: 'kind', label: 'Kind' },
                { value: 'status', label: 'Status' },
              ],
            }}
            summary={`${page.total.toLocaleString()} submissions`}
          />
          <ActiveFilters filters={active} clearHref={BASE_PATH} />

          <Panel flush label="Submissions">
            <SubmissionsTable
              rows={page.rows}
              basePath={BASE_PATH}
              sortKey={query.sort ?? 'created'}
              sortDirection={query.direction ?? 'desc'}
              sortHrefs={{
                created: sortHref('created'),
                kind: sortHref('kind'),
                status: sortHref('status'),
              }}
              emptyHint={
                isDefaultStatus
                  ? 'The quarantined queue is empty right now.'
                  : 'Try clearing a filter.'
              }
            />
          </Panel>

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

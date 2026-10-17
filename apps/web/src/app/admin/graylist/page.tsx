/**
 * Discovery graylist browser — candidates parked below the relevance threshold.
 *
 * Server component. Search, status, disposition, sort and page are URL params resolved in SQL. The
 * default view is the parked queue; promoted and archived entries are one facet click away.
 */
import type { Metadata } from 'next';
import { FacetRail, Pagination, type FacetGroup } from '@repo/ui';
import { DeskToolbar } from '../../../admin/design-system/DeskToolbar';
import {
  ActiveFilters,
  DeskTitleBar,
  Panel,
  type ActiveFilter,
} from '../../../admin/design-system/ui';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import {
  graylistQueryHref,
  hasActiveGraylistFilters,
  parseGraylistQuery,
  serializeGraylistQuery,
  toggleGraylistFacetHref,
  type GraylistQuery,
  type GraylistSortKey,
} from '../../../admin/ops/graylist-query';
import { queryGraylistFacets, queryGraylistPage } from '../../../admin/ops/graylist-store';
import { GraylistTable } from '../../../admin/ops/GraylistTable';
import { formatGraylistDisposition, formatGraylistStatus } from './graylist-labels';

export const metadata: Metadata = {
  title: 'Graylist',
  description: 'Discovery sources held back from automated promotion.',
};

/** Operational state is read at request time, never served from a cache. */
export const dynamic = 'force-dynamic';

const BASE_PATH = '/admin/graylist';

function facetGroup(
  id: string,
  label: string,
  key: 'statuses' | 'dispositions',
  buckets: readonly { readonly value: string; readonly count: number }[],
  query: GraylistQuery,
  format: (value: string) => string,
): FacetGroup {
  const active = query[key] ?? [];
  return {
    id,
    label,
    options: buckets.map((bucket) => ({
      value: bucket.value,
      label: format(bucket.value),
      count: bucket.count,
      href: toggleGraylistFacetHref(BASE_PATH, query, key, bucket.value),
      active: active.includes(bucket.value),
    })),
  };
}

export default async function GraylistPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseGraylistQuery(await searchParams);
  const [pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(() => queryGraylistPage(query), 'graylist entries'),
    readPostgresOrDegrade(() => queryGraylistFacets(query), 'graylist facets'),
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
      : { rows: [], total: 0, page: 1, pageSize: query.pageSize ?? 50, pageCount: 1 };
  const facets =
    facetsOutcome.status === 'ok' ? facetsOutcome.value : { status: [], disposition: [] };

  const filtersActive = hasActiveGraylistFilters(query);
  const facetGroups: readonly FacetGroup[] = [
    facetGroup('status', 'Status', 'statuses', facets.status, query, formatGraylistStatus),
    facetGroup(
      'disposition',
      'Disposition',
      'dispositions',
      facets.disposition,
      query,
      formatGraylistDisposition,
    ),
  ];
  const { search: _s, sort: _o, direction: _d, ...rest } = query;
  const preserved = Object.fromEntries(
    new URLSearchParams(serializeGraylistQuery({ ...rest, page: 1 })),
  );
  const active: ActiveFilter[] = [
    ...(query.search
      ? [
          {
            label: `“${query.search}”`,
            removeHref: graylistQueryHref(BASE_PATH, query, { search: '' }),
          },
        ]
      : []),
    ...(query.statuses ?? [])
      .filter(() => !(query.statuses?.length === 1 && query.statuses[0] === 'parked'))
      .map((value) => ({
        label: `Status: ${formatGraylistStatus(value)}`,
        removeHref: toggleGraylistFacetHref(BASE_PATH, query, 'statuses', value),
      })),
    ...(query.dispositions ?? []).map((value) => ({
      label: formatGraylistDisposition(value),
      removeHref: toggleGraylistFacetHref(BASE_PATH, query, 'dispositions', value),
    })),
  ];

  const sortHref = (key: GraylistSortKey): string => {
    const direction = query.sort === key ? (query.direction === 'asc' ? 'desc' : 'asc') : 'desc';
    return graylistQueryHref(BASE_PATH, query, { sort: key, direction });
  };

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Intake"
        title="Graylist"
        meta={<span>{page.total.toLocaleString()} entries</span>}
        description="Discovery candidates parked below the relevance bar for corroboration. Promoting to the Inbox and publishing stay in the triage and release desks."
        actions={
          <>
            <a className="ds-button ds-button--secondary" href="/admin/inbox">
              Open inbox
            </a>
            <a className="ds-button ds-button--secondary" href="/admin/discovery">
              Campaign runs
            </a>
          </>
        }
      />

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The graylist is unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial hold list. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <div className="ds-workbench">
        <div className="ds-workbench__rail">
          <FacetRail groups={facetGroups} clearHref={BASE_PATH} hasActiveFilters={filtersActive} />
        </div>
        <div className="ds-workbench__main">
          <DeskToolbar
            label="Search graylist"
            action={BASE_PATH}
            preserved={preserved}
            search={{ value: query.search ?? '', placeholder: 'Candidate, id, reason or adapter…' }}
            sort={{
              value: query.sort ?? 'parked',
              direction: query.direction ?? 'desc',
              options: [
                { value: 'parked', label: 'Parked' },
                { value: 'score', label: 'Score' },
                { value: 'updated', label: 'Updated' },
              ],
            }}
            summary={`${page.total.toLocaleString()} entries`}
          />
          <ActiveFilters filters={active} clearHref={BASE_PATH} />

          <Panel flush label="Graylist entries">
            <GraylistTable
              rows={page.rows}
              sortKey={query.sort ?? 'parked'}
              sortDirection={query.direction ?? 'desc'}
              sortHrefs={{
                parked: sortHref('parked'),
                score: sortHref('score'),
                updated: sortHref('updated'),
              }}
              resetHref={BASE_PATH}
            />
          </Panel>

          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            itemLabel="entries"
            hrefForPage={(target: number) => graylistQueryHref(BASE_PATH, query, { page: target })}
          />
        </div>
      </div>
    </main>
  );
}

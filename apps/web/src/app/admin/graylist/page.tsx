/**
 * Discovery graylist browser — candidates parked below the relevance threshold.
 *
 * Server component. Search, status, disposition, sort and page are URL params resolved in SQL. The
 * default view is the parked queue; promoted and archived entries are one facet click away.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { FacetRail, Pagination, Toolbar, ToolbarField, type FacetGroup } from '@repo/ui';
import { FormButton, FormInput } from '../../../admin/design-system/fields';
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
  const { search: _s, ...rest } = query;
  const preservedParams = new URLSearchParams(serializeGraylistQuery({ ...rest, page: 1 }));

  const sortHref = (key: GraylistSortKey): string => {
    const direction = query.sort === key ? (query.direction === 'asc' ? 'desc' : 'asc') : 'desc';
    return graylistQueryHref(BASE_PATH, query, { sort: key, direction });
  };

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-page__header">
        <p className="ds-page__eyebrow">Discovery</p>
        <h1 className="ds-page__title">Graylist</h1>
        <p className="ds-page__lede">
          Below-threshold discovery candidates parked for corroboration, not silently dropped.
          Review scores and reasons here; promoting to the Inbox or publishing stays in the triage
          and release desks.
        </p>
        <p className="story-review__notice">
          Next: <Link href="/admin/inbox">Open inbox</Link>
          {' · '}
          <Link href="/admin/discovery">Campaign runs</Link>
        </p>
      </header>

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
          <Toolbar
            label="Search graylist"
            action={BASE_PATH}
            preservedParams={Object.fromEntries(preservedParams.entries())}
            actions={
              <>
                <FormButton type="submit" className="ds-button ds-button--secondary">
                  Search
                </FormButton>
                {filtersActive ? (
                  <Link className="ds-button ds-button--secondary" href={BASE_PATH}>
                    Reset
                  </Link>
                ) : null}
              </>
            }
          >
            <ToolbarField label="Search">
              <FormInput
                type="search"
                name="q"
                defaultValue={query.search ?? ''}
                placeholder="Candidate, id, reason or adapter…"
              />
            </ToolbarField>
          </Toolbar>

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

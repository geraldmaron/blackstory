/**
 * Audit event browser — append-only operator and system actions.
 *
 * Server component. Search, category, actor type, date range, sort and page are URL params
 * resolved in SQL, the same shape as the catalog and submissions desks. The earlier page read the
 * latest 100 rows, so everything older was unreachable from the console.
 *
 * `/admin/api/audit` stays for callers outside this page.
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
  auditQueryHref,
  hasActiveAuditFilters,
  parseAuditQuery,
  serializeAuditQuery,
  toggleAuditFacetHref,
  type AuditQuery,
} from '../../../admin/ops/audit-query';
import { queryAuditFacets, queryAuditPage } from '../../../admin/ops/audit-store';
import { AuditTable } from '../../../admin/ops/AuditTable';

export const metadata: Metadata = {
  title: 'Audit log',
  description: 'Append-only audit trail of operator and system actions.',
};

/** An audit trail read from a cache is a different question than the one the operator asked. */
export const dynamic = 'force-dynamic';

const BASE_PATH = '/admin/audit';

function titleCase(value: string): string {
  return value.replace(/[_.]/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function facetGroup(
  id: string,
  label: string,
  key: 'categories' | 'actorTypes',
  buckets: readonly { readonly value: string; readonly count: number }[],
  query: AuditQuery,
): FacetGroup {
  const active = query[key] ?? [];
  return {
    id,
    label,
    options: buckets.map((bucket) => ({
      value: bucket.value,
      label: titleCase(bucket.value),
      count: bucket.count,
      href: toggleAuditFacetHref(BASE_PATH, query, key, bucket.value),
      active: active.includes(bucket.value),
    })),
  };
}

export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAuditQuery(await searchParams);
  const [pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(() => queryAuditPage(query), 'audit events'),
    readPostgresOrDegrade(() => queryAuditFacets(query), 'audit facets'),
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
    facetsOutcome.status === 'ok' ? facetsOutcome.value : { category: [], actorType: [] };

  const filtersActive = hasActiveAuditFilters(query);
  const facetGroups: readonly FacetGroup[] = [
    facetGroup('category', 'Category', 'categories', facets.category, query),
    facetGroup('actor', 'Actor type', 'actorTypes', facets.actorType, query),
  ];
  // Everything except the fields this form owns rides along as hidden inputs, so searching never
  // silently drops the facets or page size the operator already chose.
  const { search: _s, from: _f, to: _t, direction: _d, ...rest } = query;
  const preserved = Object.fromEntries(
    new URLSearchParams(serializeAuditQuery({ ...rest, page: 1 })),
  );
  const active: ActiveFilter[] = [
    ...(query.search
      ? [
          {
            label: `“${query.search}”`,
            removeHref: auditQueryHref(BASE_PATH, query, { search: '' }),
          },
        ]
      : []),
    ...(query.categories ?? []).map((value) => ({
      label: `Category: ${titleCase(value)}`,
      removeHref: toggleAuditFacetHref(BASE_PATH, query, 'categories', value),
    })),
    ...(query.actorTypes ?? []).map((value) => ({
      label: `Actor: ${titleCase(value)}`,
      removeHref: toggleAuditFacetHref(BASE_PATH, query, 'actorTypes', value),
    })),
    ...(query.from
      ? [
          {
            label: `From ${query.from}`,
            removeHref: auditQueryHref(BASE_PATH, query, { from: '' }),
          },
        ]
      : []),
    ...(query.to
      ? [{ label: `To ${query.to}`, removeHref: auditQueryHref(BASE_PATH, query, { to: '' }) }]
      : []),
  ];
  const nextDirection = query.direction === 'asc' ? 'desc' : 'asc';

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="System"
        title="Audit log"
        meta={<span>{page.total.toLocaleString()} events</span>}
        description="Append-only record of operator and system actions. Read-only: nothing here replays or undoes a change. The Reason column holds the note behind each transition, release and kill-switch change."
      />

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The audit log is unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial history. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <div className="ds-workbench">
        <div className="ds-workbench__rail">
          <FacetRail groups={facetGroups} clearHref={BASE_PATH} hasActiveFilters={filtersActive} />
        </div>
        <div className="ds-workbench__main">
          <DeskToolbar
            label="Search audit events"
            action={BASE_PATH}
            preserved={preserved}
            search={{
              value: query.search ?? '',
              placeholder: 'Action, reason, actor, subject, entity or release…',
            }}
            extra={
              <>
                <label className="admin-base-controls__field">
                  <span>From</span>
                  <input type="date" name="from" defaultValue={query.from ?? ''} />
                </label>
                <label className="admin-base-controls__field">
                  <span>To</span>
                  <input type="date" name="to" defaultValue={query.to ?? ''} />
                </label>
              </>
            }
            sort={{
              value: 'time',
              direction: query.direction ?? 'desc',
              options: [{ value: 'time', label: 'Time' }],
            }}
            summary={`${page.total.toLocaleString()} events`}
          />
          <ActiveFilters filters={active} clearHref={BASE_PATH} />

          <Panel flush label="Audit events">
            <AuditTable
              rows={page.rows}
              sortHref={auditQueryHref(BASE_PATH, query, { direction: nextDirection })}
              sortDirection={query.direction ?? 'desc'}
              resetHref={BASE_PATH}
            />
          </Panel>

          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            itemLabel="events"
            hrefForPage={(target: number) => auditQueryHref(BASE_PATH, query, { page: target })}
          />
        </div>
      </div>
    </main>
  );
}

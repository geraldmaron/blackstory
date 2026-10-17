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
import Link from 'next/link';
import { FacetRail, Pagination, Toolbar, ToolbarField, type FacetGroup } from '@repo/ui';
import { FormButton, FormInput } from '../../../admin/design-system/fields';
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
  // silently drops the facets, sort or page the operator already chose.
  const { search: _s, from: _f, to: _t, ...rest } = query;
  const preservedParams = new URLSearchParams(serializeAuditQuery({ ...rest, page: 1 }));
  const nextDirection = query.direction === 'asc' ? 'desc' : 'asc';

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-page__header">
        <p className="ds-page__eyebrow">Operations</p>
        <h1 className="ds-page__title">Audit log</h1>
        <p className="ds-page__lede">
          Append-only audit trail of operator and system actions across intake, triage, and
          publication. Read-only history; this desk does not replay, undo, or mutate underlying
          records. The Reason column holds the operator note behind each transition, release and
          kill-switch change.
        </p>
      </header>

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
          <Toolbar
            label="Search audit events"
            action={BASE_PATH}
            preservedParams={Object.fromEntries(preservedParams.entries())}
            actions={
              <>
                <FormButton type="submit" className="ds-button ds-button--secondary">
                  Apply
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
                placeholder="Action, reason, actor, subject, entity or release…"
              />
            </ToolbarField>
            <ToolbarField label="From">
              <FormInput type="date" name="from" defaultValue={query.from ?? ''} />
            </ToolbarField>
            <ToolbarField label="To">
              <FormInput type="date" name="to" defaultValue={query.to ?? ''} />
            </ToolbarField>
          </Toolbar>

          <AuditTable
            rows={page.rows}
            sortHref={auditQueryHref(BASE_PATH, query, { direction: nextDirection })}
            sortDirection={query.direction ?? 'desc'}
            resetHref={BASE_PATH}
          />

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

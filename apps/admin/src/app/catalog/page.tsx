/**
 * Entity workbench — the desk for managing canonical entities at scale.
 *
 * This is a server component. Filters, sort, and page live in the URL and resolve in SQL before
 * the first byte, replacing a client page whose every navigation cost a hydrate, a token
 * refresh, and two fetches before anything appeared.
 *
 * Reach mattered more than speed: the old page fetched `LIMIT 200 ORDER BY updated_at DESC` and
 * filtered that slice in the browser, so 3,897 of 4,097 entities could not be reached by any
 * search term or scroll. Every row is now addressable.
 *
 * Decisions recorded here still never publish. The next release build reads them, and the
 * signed-manifest privileged-apply flow remains the only thing that makes anything live.
 */
import Link from 'next/link';
import { SENSITIVITY_CLASSES } from '@repo/domain';
import { FacetRail, Pagination, type FacetGroup } from '@repo/ui';
import {
  entityQueryHref,
  hasActiveFilters,
  parseEntityQuery,
  serializeEntityQuery,
  toggleFacetHref,
} from '../../lib/entity-query-params';
import {
  queryEntityFacets,
  queryEntityPage,
  type EntityQuery,
  type EntitySortKey,
  type FacetBucket,
} from '../../lib/entity-query';
import { readPostgresOrDegrade } from '../../lib/postgres-client';
import { readVerifiedAdminIdentity } from '../../auth/supabase-server';
import { staffRoleHasPermission } from '../../auth/staff-permissions';
import { EntityWorkbenchTable } from './EntityWorkbenchTable';
import { formatLivingStatusLabel } from './living-status-label';

const BASE_PATH = '/catalog';

type FacetKey = 'kinds' | 'entityClasses' | 'livingStatuses' | 'sensitivityClasses';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function toFacetGroup(
  id: string,
  label: string,
  key: FacetKey,
  buckets: readonly FacetBucket[],
  query: EntityQuery,
  formatLabel: (value: string) => string = titleCase,
): FacetGroup {
  const active = query[key] ?? [];
  return {
    id,
    label,
    options: buckets.map((bucket) => ({
      value: bucket.value,
      label: formatLabel(bucket.value),
      count: bucket.count,
      href: toggleFacetHref(BASE_PATH, query, key, bucket.value),
      active: active.includes(bucket.value),
    })),
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseEntityQuery(await searchParams);

  // Rows and facet counts in parallel — both filtered, both resolved before first paint.
  // Both degrade rather than hang: this page blocks first byte on Postgres, so an unreachable
  // database has to cost a banner in seconds, not a render that never returns (repo-7pqy).
  const [identity, pageOutcome, facetsOutcome] = await Promise.all([
    readVerifiedAdminIdentity(),
    readPostgresOrDegrade(() => queryEntityPage(query), 'catalog entities'),
    readPostgresOrDegrade(() => queryEntityFacets(query), 'catalog facets'),
  ]);

  // Resolved here, not in the client island: the browser only knows the operator is signed in,
  // not which staff role they hold, so a role-gated affordance has to be decided server-side.
  const canMerge = identity ? staffRoleHasPermission(identity.role, 'canonical:merge') : false;
  const canBulkEdit = identity
    ? staffRoleHasPermission(identity.role, 'canonical:bulk_write')
    : false;

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
  const facets =
    facetsOutcome.status === 'ok'
      ? facetsOutcome.value
      : { kind: [], entityClass: [], livingStatus: [], sensitivityClass: [] };

  // Clicking the active sort column flips its direction; a new column takes its natural default.
  const sortHref = (key: EntitySortKey): string => {
    const naturalDirection = key === 'name' || key === 'kind' ? 'asc' : 'desc';
    const direction =
      query.sort === key ? (query.direction === 'asc' ? 'desc' : 'asc') : naturalDirection;
    return entityQueryHref(BASE_PATH, query, { sort: key, direction });
  };

  const facetGroups: readonly FacetGroup[] = [
    toFacetGroup('class', 'Class', 'entityClasses', facets.entityClass, query),
    toFacetGroup('kind', 'Kind', 'kinds', facets.kind, query),
    toFacetGroup(
      'living',
      'Living status',
      'livingStatuses',
      facets.livingStatus,
      query,
      formatLivingStatusLabel,
    ),
    toFacetGroup(
      'sensitivity',
      'Sensitivity',
      'sensitivityClasses',
      facets.sensitivityClass,
      query,
    ),
  ];

  const filtersActive = hasActiveFilters(query);

  // Carried as hidden inputs so submitting the search box keeps the rest of the view intact.
  const { search: _omitSearch, ...queryWithoutSearch } = query;
  const preservedParams = new URLSearchParams(
    serializeEntityQuery({ ...queryWithoutSearch, page: 1 }),
  );

  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-page__header">
        <p className="ds-page__eyebrow">Canonical catalog</p>
        <h1 className="ds-page__title">Entities</h1>
        <p className="ds-page__lede">
          Every canonical entity in the archive — filter, sort, and act in bulk. Nothing here
          publishes on its own; the next release build reads these decisions, and the signed
          manifest is still what makes anything live.
        </p>
        <p className="story-review__notice">
          <Link href="/inbox">Pending research</Link>
          {' · '}
          <Link href="/cases">All cases</Link>
        </p>
      </header>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The catalog database did not answer, so this page is showing nothing rather than waiting.
          Filters and search still work once it is reachable — reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <div className="ds-workbench">
        <div className="ds-workbench__rail">
          <FacetRail
            groups={facetGroups}
            clearHref={BASE_PATH}
            hasActiveFilters={filtersActive}
            footer={
              <ul className="ds-facet__options">
                <li>
                  <a
                    className={`ds-facet__option${
                      query.withoutClaims ? ' ds-facet__option--active' : ''
                    }`}
                    href={entityQueryHref(BASE_PATH, query, {
                      withoutClaims: !query.withoutClaims,
                    })}
                  >
                    <span className="ds-facet__option-label">No claims yet</span>
                  </a>
                </li>
                <li>
                  <a
                    className={`ds-facet__option${
                      query.mergeState === 'absorbed' ? ' ds-facet__option--active' : ''
                    }`}
                    href={entityQueryHref(BASE_PATH, query, {
                      mergeState: query.mergeState === 'absorbed' ? 'active' : 'absorbed',
                    })}
                  >
                    <span className="ds-facet__option-label">Merged away</span>
                  </a>
                </li>
              </ul>
            }
          />
        </div>

        <div className="ds-workbench__main">
          {/* A plain GET form: search survives with JS off and leaves a shareable URL. */}
          <form className="story-review__toolbar" action={BASE_PATH} method="get" role="search">
            <label className="story-review__field">
              <span>Search</span>
              <input
                type="search"
                name="q"
                defaultValue={query.search ?? ''}
                placeholder="Name, id, alias, or identifier…"
              />
            </label>
            {[...preservedParams.entries()].map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="ds-button ds-button--secondary">
              Search
            </button>
            {filtersActive ? (
              <a className="ds-button ds-button--secondary" href={BASE_PATH}>
                Reset
              </a>
            ) : null}
          </form>

          <EntityWorkbenchTable
            rows={page.rows}
            total={page.total}
            searchQuery={serializeEntityQuery(query)}
            canMerge={canMerge}
            canBulkEdit={canBulkEdit}
            sensitivityClasses={SENSITIVITY_CLASSES}
            sortKey={query.sort ?? 'updated'}
            sortDirection={query.direction ?? 'desc'}
            sortHrefs={{
              name: sortHref('name'),
              kind: sortHref('kind'),
              claims: sortHref('claims'),
              updated: sortHref('updated'),
            }}
          />

          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            itemLabel="entities"
            hrefForPage={(target: number) => entityQueryHref(BASE_PATH, query, { page: target })}
          />
        </div>
      </div>
    </main>
  );
}

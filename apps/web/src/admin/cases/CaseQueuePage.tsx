/**
 * Shared server body of `/admin/inbox` and `/admin/cases`.
 *
 * Filters, sort and page live in the URL and resolve in SQL before the first byte, the same shape
 * as the catalog and submissions desks. {@link CaseQueue} stays a client component because
 * selection, the detail sheet, transitions and assignment are interactive; it never re-filters the
 * rows it is handed.
 */
import type { ResearchCaseState } from '@repo/domain';
import { readPostgresOrDegrade } from '@/admin/lib/canonical-postgres-client';
import { queryCasePage, queryCaseStateFacets } from '@/admin/lib/postgres-research-cases';
import { CaseQueue } from './CaseQueue';
import { parseCaseQuery, type CaseQueueMode, type QueryParamInput } from './case-query-params';
import type { AdminCaseListItem } from './research-case-types';

export async function CaseQueuePage({
  mode,
  searchParams,
}: {
  readonly mode: CaseQueueMode;
  readonly searchParams: QueryParamInput;
}) {
  const query = parseCaseQuery(searchParams, mode);

  // Rows and facet counts in parallel; both degrade rather than hang on an unreachable database.
  const [pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(
      () => queryCasePage(query),
      mode === 'inbox' ? 'inbox queue' : 'research cases',
    ),
    readPostgresOrDegrade(() => queryCaseStateFacets(query), 'case state counts'),
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
  const stateFacets = facetsOutcome.status === 'ok' ? facetsOutcome.value : [];

  const rows: readonly AdminCaseListItem[] = page.rows.map((row) => ({
    id: row.id,
    title: row.title,
    state: row.state as ResearchCaseState,
    candidateId: row.candidateId,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    checklistComplete: row.checklistComplete,
    checklistTotal: row.checklistTotal,
    ...(row.assigneeId ? { assigneeId: row.assigneeId } : {}),
  }));

  return (
    <main className="ds-container ds-page" id="main">
      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          {mode === 'inbox'
            ? 'The triage queue is unavailable — the operational database did not answer. Nothing is listed rather than a partial queue, because a half-loaded inbox looks like a worked one. Reload to retry. '
            : 'Research cases are unavailable — the operational database did not answer. Nothing is listed rather than a partial set. Reload to retry. '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}
      <CaseQueue
        mode={mode}
        rows={rows}
        total={page.total}
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        query={query}
        stateFacets={stateFacets}
      />
    </main>
  );
}

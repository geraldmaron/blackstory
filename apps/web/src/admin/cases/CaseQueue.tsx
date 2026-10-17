/**
 * Unified research-case queue: filters, multi-select, full detail sheet, live transitions.
 */
'use client';

import { FormButton, FormInput, FormSelect, FormTextarea } from '../design-system/fields';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pagination } from '@repo/ui';
import { DeskToolbar } from '../design-system/DeskToolbar';
import { ActiveFilters, DeskTitleBar, Panel, type ActiveFilter } from '../design-system/ui';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import type { CaseQuery, CaseStateBucket } from './case-query-types';
import {
  RESEARCH_CASE_BULK_LIMIT,
  actionLabel,
  commonActionsForSelection,
  formatWhen,
  toggleAllCaseSelection,
  toggleCaseSelection,
} from './case-queue';
import {
  caseQueryHref,
  defaultCaseStates,
  serializeCaseQuery,
  type CaseQueueMode,
} from './case-query-params';
import {
  CASE_QUEUE_INTENT_COPY,
  CASE_TRIAGE_STEPS,
  EXCLUSION_REASON_CODES,
  INBOX_CASE_STATES,
  actionHelp,
  legalActionsForState,
  missingDecisionReasonMessage,
  stateLabel,
  type AdminCaseDetail,
  type AdminCaseListItem,
  type AdminCaseTransitionAction,
} from './research-case-types';
import type { ResearchCaseReasonCode, ResearchCaseState } from '@repo/domain';
import './case-queue.css';

export type CaseQueueProps = {
  readonly mode: CaseQueueMode;
  /** One server-filtered, server-sorted page; the client never re-filters it. */
  readonly rows: readonly AdminCaseListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly query: CaseQuery;
  /** State counts under the active search and assignee filter, so chips show real totals. */
  readonly stateFacets: readonly CaseStateBucket[];
};

export function CaseQueue({
  mode,
  rows,
  total,
  page,
  pageCount,
  pageSize,
  query,
  stateFacets,
}: CaseQueueProps) {
  const router = useRouter();
  const { getIdToken } = useAdminAuth();
  const basePath = mode === 'inbox' ? '/admin/inbox' : '/admin/cases';
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCaseDetail | null>(null);
  const [legalActions, setLegalActions] = useState<readonly AdminCaseTransitionAction[]>([]);
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<ResearchCaseReasonCode>(
    EXCLUSION_REASON_CODES[0] ?? 'outside_scope',
  );
  const [mergeTarget, setMergeTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bulkReasonRef = useRef<HTMLInputElement>(null);
  const sheetReasonRef = useRef<HTMLTextAreaElement>(null);
  const sheetTitleId = useId();
  const reasonHintId = useId();

  function focusReasonField() {
    (sheetReasonRef.current ?? bulkReasonRef.current)?.focus();
  }

  /** Rows are server-rendered, so a refresh is a re-render of the route, not a client fetch. */
  const load = useCallback(async () => {
    router.refresh();
  }, [router]);

  // A new page or filter is a new set of rows; a selection from the old one must not carry over.
  const viewKey = serializeCaseQuery(query, mode);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewKey]);

  const visible = rows;
  const stateCount = useMemo(
    () => new Map(stateFacets.map((bucket) => [bucket.value, bucket.count])),
    [stateFacets],
  );
  const inboxCount = INBOX_CASE_STATES.reduce(
    (sum, state) => sum + (stateCount.get(state) ?? 0),
    0,
  );
  const allCount = stateFacets.reduce((sum, bucket) => sum + bucket.count, 0);
  const bulkActions = useMemo(
    () => commonActionsForSelection(rows, selectedIds),
    [rows, selectedIds],
  );
  const defaultStates = defaultCaseStates(mode);
  const activeStates = query.states ?? [];
  const isInboxView =
    activeStates.length === INBOX_CASE_STATES.length &&
    INBOX_CASE_STATES.every((state) => activeStates.includes(state));
  const sortHref = (key: NonNullable<CaseQuery['sort']>): string => {
    const natural = key === 'title' || key === 'state' ? 'asc' : 'desc';
    const direction = query.sort === key ? (query.direction === 'asc' ? 'desc' : 'asc') : natural;
    return caseQueryHref(basePath, mode, query, { sort: key, direction });
  };
  const sortMark = (key: NonNullable<CaseQuery['sort']>): string =>
    query.sort === key ? (query.direction === 'asc' ? ' ↑' : ' ↓') : '';
  const ariaSort = (key: NonNullable<CaseQuery['sort']>): 'ascending' | 'descending' | 'none' =>
    query.sort === key ? (query.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const activeFilters: ActiveFilter[] = [
    ...(query.search
      ? [
          {
            label: `“${query.search}”`,
            removeHref: caseQueryHref(basePath, mode, query, { search: '' }),
          },
        ]
      : []),
    ...(query.assignee && query.assignee !== 'any'
      ? [
          {
            label: query.assignee === 'assigned' ? 'Assigned' : 'Unassigned',
            removeHref: caseQueryHref(basePath, mode, query, { assignee: 'any' }),
          },
        ]
      : []),
  ];
  const stateChips: readonly {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly states: readonly string[];
  }[] = [
    ...(mode === 'cases'
      ? [{ id: 'all', label: 'All states', count: allCount, states: [] as readonly string[] }]
      : []),
    { id: 'inbox', label: 'Inbox', count: inboxCount, states: INBOX_CASE_STATES },
    ...(mode === 'inbox' ? INBOX_CASE_STATES : stateFacets.map((b) => b.value as ResearchCaseState))
      .filter((state, index, all) => all.indexOf(state) === index)
      .map((state) => ({
        id: state,
        label: stateLabel(state as ResearchCaseState),
        count: stateCount.get(state) ?? 0,
        states: [state] as readonly string[],
      })),
  ];

  const openDetail = useCallback(
    async (caseId: string) => {
      setActiveId(caseId);
      setDetail(null);
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) return;
        const response = await fetch(`/admin/api/research-cases/${caseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as {
          item?: AdminCaseDetail;
          legalActions?: AdminCaseTransitionAction[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? `Detail failed (${response.status})`);
        setDetail(body.item ?? null);
        setLegalActions(
          body.legalActions ?? (body.item ? legalActionsForState(body.item.state) : []),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [getIdToken],
  );

  const closeSheet = useCallback(() => {
    setActiveId(null);
    setDetail(null);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeId, closeSheet]);

  async function runTransition(action: AdminCaseTransitionAction, caseIds: readonly string[]) {
    if (caseIds.length === 0) return;
    if (!reason.trim()) {
      setError(missingDecisionReasonMessage(action));
      focusReasonField();
      return;
    }
    if (action === 'merge' && !mergeTarget.trim()) {
      setError('Enter the research case id to merge into before Merge.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const payload = {
        action,
        reason: reason.trim(),
        ...(action === 'exclude' ? { reasonCode } : {}),
        ...(action === 'merge' && mergeTarget.trim()
          ? { mergedIntoCaseId: mergeTarget.trim() }
          : {}),
      };

      if (caseIds.length === 1) {
        const response = await fetch(`/admin/api/research-cases/${caseIds[0]}/transition`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? `Transition failed (${response.status})`);
        setStatus(`${actionLabel(action)} recorded`);
      } else {
        const response = await fetch('/admin/api/research-cases/bulk-transition', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ caseIds, ...payload }),
        });
        const body = (await response.json()) as {
          error?: string;
          succeeded?: number;
          failed?: number;
        };
        if (!response.ok) throw new Error(body.error ?? `Bulk failed (${response.status})`);
        setStatus(
          `Bulk ${actionLabel(action)}: ${body.succeeded ?? 0} succeeded` +
            (body.failed ? `, ${body.failed} failed` : ''),
        );
      }

      setSelectedIds(new Set());
      setReason('');
      await load();
      if (activeId && caseIds.includes(activeId)) {
        await openDetail(activeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function assignToMe() {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getIdToken(true);
      if (!token) {
        setError('Sign in required');
        return;
      }
      const response = await fetch(`/admin/api/research-cases/${activeId}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() || 'Assigned to self' }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Assign failed (${response.status})`);
      setStatus('Assigned to you');
      await load();
      await openDetail(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selectedIds.has(row.id));

  const showChecklistColumn = visible.some((row) => row.checklistTotal > 0);

  return (
    <div className="acq" data-mode={mode}>
      <DeskTitleBar
        eyebrow={mode === 'inbox' ? 'Research' : 'Research / all states'}
        title={mode === 'inbox' ? 'Inbox' : 'Research cases'}
        meta={<span>{total.toLocaleString()} in this view</span>}
        description={CASE_QUEUE_INTENT_COPY[mode]}
        actions={
          <FormButton
            type="button"
            className="acq__button acq__button--ghost"
            onClick={() => void load()}
            disabled={busy}
          >
            Refresh
          </FormButton>
        }
      />
      <details className="acq__howto">
        <summary>How to decide on a case</summary>
        <ol className="acq__steps" aria-label="How to decide on a case">
          {CASE_TRIAGE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      <nav className="acq__stats" aria-label="Filter by state">
        {stateChips.map((chip) => {
          const active =
            chip.id === 'all'
              ? activeStates.length === 0
              : chip.id === 'inbox'
                ? isInboxView
                : activeStates.length === 1 && activeStates[0] === chip.id;
          return (
            <Link
              key={chip.id}
              href={caseQueryHref(basePath, mode, query, { states: chip.states })}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'true' : undefined}
            >
              {chip.label} <strong>{chip.count.toLocaleString()}</strong>
            </Link>
          );
        })}
      </nav>

      <DeskToolbar
        label="Search, filter and sort"
        action={basePath}
        preserved={
          activeStates.length > 0 && activeStates.join(',') !== defaultStates.join(',')
            ? { state: activeStates.join(',') }
            : {}
        }
        search={{
          value: query.search ?? '',
          placeholder: 'Title, id, candidate or reviewer…',
        }}
        filters={[
          {
            name: 'assignee',
            label: 'Assignee',
            value: query.assignee ?? 'any',
            options: [
              { value: 'any', label: 'Anyone' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'unassigned', label: 'Unassigned' },
            ],
          },
        ]}
        sort={{
          value: query.sort ?? 'updated',
          direction: query.direction ?? 'desc',
          options: [
            { value: 'updated', label: 'Updated' },
            { value: 'created', label: 'Created' },
            { value: 'title', label: 'Title' },
            { value: 'state', label: 'State' },
            { value: 'checklist', label: 'Checklist' },
          ],
        }}
        summary={`${total.toLocaleString()} cases`}
      />
      <ActiveFilters filters={activeFilters} clearHref={basePath} />

      {error ? (
        <p className="acq__alert" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="acq__notice" role="status">
          {status}
        </p>
      ) : null}

      {selectedIds.size > 0 ? (
        <section className="acq__bulk" aria-label="Bulk actions">
          <p>
            <strong>{selectedIds.size}</strong> selected
            {selectedIds.size > RESEARCH_CASE_BULK_LIMIT
              ? ` (over limit of ${RESEARCH_CASE_BULK_LIMIT})`
              : ''}
          </p>
          <label className="acq__field acq__field--grow">
            <span>Decision reason (required)</span>
            <FormInput
              ref={bulkReasonRef}
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Example: On-topic Tulsa / Greenwood lead from discovery"
              aria-describedby={reasonHintId}
              required
            />
          </label>
          <p className="acq__bulk-note" id={reasonHintId}>
            Write the reason first, then choose an action. Bulk moves are audited and do not
            publish.
          </p>
          <div className="acq__bulk-actions">
            {bulkActions.map((action) => (
              <FormButton
                key={action}
                type="button"
                className={
                  action === 'exclude' ? 'acq__button' : 'acq__button acq__button--primary'
                }
                title={actionHelp(action)}
                disabled={busy || selectedIds.size > RESEARCH_CASE_BULK_LIMIT || !reason.trim()}
                onClick={() => void runTransition(action, [...selectedIds])}
              >
                {actionLabel(action)}
              </FormButton>
            ))}
            <FormButton
              type="button"
              className="acq__button acq__button--ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </FormButton>
          </div>
        </section>
      ) : null}

      {visible.length === 0 ? (
        <p className="acq__empty">No research cases match this filter.</p>
      ) : (
        <Panel flush label="Research cases">
          <div className="acq__table-wrap">
            <table className="acq__table">
              <caption className="ds-visually-hidden">
                Research cases: showing {visible.length} of {total.toLocaleString()}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <label className="acq__checkbox-hit">
                      <FormInput
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={() =>
                          setSelectedIds((current) =>
                            toggleAllCaseSelection(
                              current,
                              visible.map((row) => row.id),
                              !allVisibleSelected,
                            ),
                          )
                        }
                        aria-label="Select all visible cases"
                      />
                    </label>
                  </th>
                  <th scope="col" aria-sort={ariaSort('title')}>
                    <Link href={sortHref('title')}>Title{sortMark('title')}</Link>
                  </th>
                  <th scope="col" aria-sort={ariaSort('state')}>
                    <Link href={sortHref('state')}>State{sortMark('state')}</Link>
                  </th>
                  {showChecklistColumn ? (
                    <th scope="col" aria-sort={ariaSort('checklist')}>
                      <Link href={sortHref('checklist')}>Checklist{sortMark('checklist')}</Link>
                    </th>
                  ) : null}
                  <th scope="col">Assignee</th>
                  <th scope="col" aria-sort={ariaSort('updated')}>
                    <Link href={sortHref('updated')}>Updated{sortMark('updated')}</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const isActive = activeId === row.id;
                  const isChecked = selectedIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={[
                        'acq__row',
                        isActive ? 'is-selected' : '',
                        isChecked ? 'is-checked' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => void openDetail(row.id)}
                      aria-selected={isActive}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <label className="acq__checkbox-hit">
                          <FormInput
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              setSelectedIds((current) => toggleCaseSelection(current, row.id))
                            }
                            aria-label={`Select ${row.title}`}
                            disabled={!isChecked && selectedIds.size >= RESEARCH_CASE_BULK_LIMIT}
                          />
                        </label>
                      </td>
                      <td>
                        <span className="acq__row-title" title={row.title}>
                          {row.title}
                        </span>
                        <span className="acq__row-id">{row.id}</span>
                      </td>
                      <td>
                        <span className="acq__badge">{stateLabel(row.state)}</span>
                      </td>
                      {showChecklistColumn ? (
                        <td className="acq__mono">
                          {row.checklistTotal === 0 ? (
                            <span className="acq__not-set">Not set</span>
                          ) : (
                            `${row.checklistComplete}/${row.checklistTotal}`
                          )}
                        </td>
                      ) : null}
                      <td className="acq__mono">
                        {row.assigneeId ? (
                          row.assigneeId
                        ) : (
                          <span className="acq__not-set">Unassigned</span>
                        )}
                      </td>
                      <td className="acq__updated">{formatWhen(row.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={total}
        itemLabel="cases"
        hrefForPage={(target: number) => caseQueryHref(basePath, mode, query, { page: target })}
      />

      <div className={`acq-sheet-portal${activeId ? ' is-open' : ''}`} aria-hidden={!activeId}>
        {activeId ? (
          <>
            <FormButton
              type="button"
              className="acq-sheet-backdrop"
              aria-label="Close detail panel"
              onClick={closeSheet}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              className="acq-sheet"
            >
              <header className="acq-sheet__header">
                <div>
                  <h2 className="acq-sheet__title" id={sheetTitleId}>
                    {detail?.title ?? 'Loading…'}
                  </h2>
                  <p className="acq-sheet__meta">{activeId}</p>
                </div>
                <div className="acq-sheet__header-actions">
                  <Link
                    className="acq__button acq__button--ghost"
                    href={`/admin/cases/${activeId}`}
                  >
                    Open full page
                  </Link>
                  <FormButton
                    ref={closeRef}
                    type="button"
                    className="acq__button acq__button--ghost"
                    onClick={closeSheet}
                  >
                    Close
                  </FormButton>
                </div>
              </header>

              <div className="acq-sheet__body">
                {!detail ? (
                  <p className="acq-sheet__meta">Loading case detail…</p>
                ) : (
                  <>
                    <p className="acq-sheet__meta">
                      <span className="acq__badge">{stateLabel(detail.state)}</span>
                    </p>
                    <dl className="acq-sheet__dl">
                      <div>
                        <dt>Candidate / submission</dt>
                        <dd className="acq__mono">{detail.candidateId}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatWhen(detail.updatedAt)}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatWhen(detail.createdAt)}</dd>
                      </div>
                      {detail.placeHint ? (
                        <div>
                          <dt>Place</dt>
                          <dd>{detail.placeHint}</dd>
                        </div>
                      ) : null}
                      {detail.assignment ? (
                        <div>
                          <dt>Assignee</dt>
                          <dd>
                            {detail.assignment.reviewerId} · {detail.assignment.priority} ·{' '}
                            {detail.assignment.queue}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <p className="acq-sheet__notice" role="note">
                      Private research case — nothing public yet. Do not link to a public entity
                      page until a release includes it.
                    </p>

                    <section aria-labelledby="checklist-heading">
                      <h3 id="checklist-heading">Evidence checklist</h3>
                      {detail.checklist.items.length === 0 ? (
                        <p className="acq-sheet__meta">No checklist items recorded yet.</p>
                      ) : (
                        <ul className="acq-sheet__list">
                          {detail.checklist.items.map((item) => (
                            <li key={item.key}>
                              <strong>{item.complete ? 'Done' : 'Open'}</strong> · {item.key}
                              {item.note ? ` — ${item.note}` : ''}
                              {item.evidenceIds.length > 0
                                ? ` · evidence ${item.evidenceIds.join(', ')}`
                                : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {detail.relevanceAssessment ? (
                      <section aria-labelledby="relevance-heading">
                        <h3 id="relevance-heading">Relevance</h3>
                        <p>
                          {detail.relevanceAssessment.decision}
                          {detail.relevanceAssessment.passes ? ' (passes)' : ' (fails)'}
                        </p>
                        <p>{detail.relevanceAssessment.whyThisAppears}</p>
                      </section>
                    ) : null}

                    <section aria-labelledby="history-heading">
                      <h3 id="history-heading">History</h3>
                      {detail.history.length === 0 ? (
                        <p className="acq-sheet__meta">No transitions yet.</p>
                      ) : (
                        <ol className="acq-sheet__timeline">
                          {[...detail.history].reverse().map((event, index) => (
                            <li key={`${event.occurredAt}-${index}`}>
                              <span className="acq__mono">
                                {event.from} → {event.to}
                              </span>
                              <span>
                                {event.reasonCode}: {event.reason}
                              </span>
                              <span className="acq-sheet__meta">
                                {formatWhen(event.occurredAt)} · {event.actorId}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </>
                )}
              </div>

              <footer className="acq-sheet__footer">
                <div className="acq-sheet__decide">
                  <h3 className="acq-sheet__decide-title">Decide</h3>
                  <p className="acq-sheet__decide-lede" id={reasonHintId}>
                    Write a decision reason, then choose an action. Available moves for this state:
                  </p>
                  {legalActions.length > 0 ? (
                    <ul className="acq-sheet__action-help">
                      {legalActions.map((action) => (
                        <li key={action}>
                          <strong>{actionLabel(action)}.</strong> {actionHelp(action)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="acq-sheet__meta">
                      No triage actions for this state — browse only, or continue enrichment
                      elsewhere.
                    </p>
                  )}
                </div>
                <label className="acq__field acq__field--grow">
                  <span>Decision reason (required)</span>
                  <FormTextarea
                    ref={sheetReasonRef}
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Example: On-topic Tulsa / Greenwood lead from discovery"
                    aria-describedby={reasonHintId}
                    required
                  />
                </label>
                {legalActions.includes('exclude') ? (
                  <label className="acq__field">
                    <span>Exclude reason code</span>
                    <FormSelect
                      value={reasonCode}
                      onValueChange={(nextValue) =>
                        setReasonCode(nextValue as ResearchCaseReasonCode)
                      }
                      aria-label="Exclude reason code"
                    >
                      {EXCLUSION_REASON_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </FormSelect>
                  </label>
                ) : null}
                {legalActions.includes('merge') ? (
                  <label className="acq__field acq__field--grow">
                    <span>Merge into case id</span>
                    <FormInput
                      type="text"
                      value={mergeTarget}
                      onChange={(event) => setMergeTarget(event.target.value)}
                      placeholder="Target research case id"
                    />
                  </label>
                ) : null}
                <div className="acq__bulk-actions">
                  {legalActions.map((action) => (
                    <FormButton
                      key={action}
                      type="button"
                      className={
                        action === 'exclude' || action === 'merge'
                          ? 'acq__button'
                          : 'acq__button acq__button--primary'
                      }
                      title={actionHelp(action)}
                      disabled={busy || !reason.trim()}
                      onClick={() => void runTransition(action, [activeId])}
                    >
                      {actionLabel(action)}
                    </FormButton>
                  ))}
                  <FormButton
                    type="button"
                    className="acq__button acq__button--ghost"
                    disabled={busy}
                    onClick={() => void assignToMe()}
                  >
                    Assign to me
                  </FormButton>
                </div>
              </footer>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

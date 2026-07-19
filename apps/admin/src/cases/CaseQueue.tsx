/**
 * Unified research-case queue: filters, multi-select, full detail sheet, live transitions.
 */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import {
  RESEARCH_CASE_BULK_LIMIT,
  actionLabel,
  applyCaseQueue,
  commonActionsForSelection,
  countCaseQueue,
  DEFAULT_CASE_QUEUE_QUERY,
  formatWhen,
  toggleAllCaseSelection,
  toggleCaseSelection,
  type CaseQueueQuery,
  type CaseQueueSortDirection,
  type CaseQueueSortKey,
} from './case-queue';
import {
  CASE_QUEUE_INTENT_COPY,
  CASE_TRIAGE_STEPS,
  EXCLUSION_REASON_CODES,
  actionHelp,
  filterChipLabel,
  legalActionsForState,
  missingDecisionReasonMessage,
  stateLabel,
  type AdminCaseDetail,
  type AdminCaseListItem,
  type AdminCaseTransitionAction,
} from './research-case-types';
import type { ResearchCaseReasonCode } from '@repo/domain';
import './case-queue.css';

export type CaseQueueProps = {
  readonly mode: 'inbox' | 'cases';
  readonly initialRows?: readonly AdminCaseListItem[];
};

export function CaseQueue({ mode, initialRows = [] }: CaseQueueProps) {
  const { getIdToken, user } = useAdminAuth();
  const [rows, setRows] = useState<readonly AdminCaseListItem[]>(initialRows);
  const [query, setQuery] = useState<CaseQueueQuery>({
    ...DEFAULT_CASE_QUEUE_QUERY,
    state: mode === 'inbox' ? 'inbox' : 'all',
  });
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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bulkReasonRef = useRef<HTMLInputElement>(null);
  const sheetReasonRef = useRef<HTMLTextAreaElement>(null);
  const sheetTitleId = useId();
  const reasonHintId = useId();

  function focusReasonField() {
    (sheetReasonRef.current ?? bulkReasonRef.current)?.focus();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setRows([]);
        return;
      }
      const states = mode === 'inbox' ? 'inbox' : 'all';
      const response = await fetch(`/api/research-cases?states=${states}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { items?: AdminCaseListItem[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Load failed (${response.status})`);
      setRows(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken, mode]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const counts = useMemo(() => countCaseQueue(rows), [rows]);
  const visible = useMemo(() => applyCaseQueue(rows, query), [rows, query]);
  const bulkActions = useMemo(
    () => commonActionsForSelection(rows, selectedIds),
    [rows, selectedIds],
  );

  const openDetail = useCallback(
    async (caseId: string) => {
      setActiveId(caseId);
      setDetail(null);
      setError(null);
      try {
        const token = await getIdToken();
        if (!token) return;
        const response = await fetch(`/api/research-cases/${caseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as {
          item?: AdminCaseDetail;
          legalActions?: AdminCaseTransitionAction[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? `Detail failed (${response.status})`);
        setDetail(body.item ?? null);
        setLegalActions(body.legalActions ?? (body.item ? legalActionsForState(body.item.state) : []));
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

  function patchQuery(partial: Partial<CaseQueueQuery>) {
    setQuery((current) => ({ ...current, ...partial }));
  }

  async function runTransition(
    action: AdminCaseTransitionAction,
    caseIds: readonly string[],
  ) {
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
        const response = await fetch(`/api/research-cases/${caseIds[0]}/transition`, {
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
        const response = await fetch('/api/research-cases/bulk-transition', {
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
      const response = await fetch(`/api/research-cases/${activeId}/assign`, {
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

  const allVisibleSelected =
    visible.length > 0 && visible.every((row) => selectedIds.has(row.id));

  const showChecklistColumn = visible.some((row) => row.checklistTotal > 0);
  const showPlaceColumn = visible.some((row) => Boolean(row.placeHint?.trim()));

  return (
    <div className="acq" data-mode={mode}>
      <header className="acq__header">
        <div>
          <p className="acq__eyebrow">{mode === 'inbox' ? 'Work queue' : 'All cases'}</p>
          <h1 className="acq__title">
            {mode === 'inbox' ? 'Inbox' : 'Research cases'}
          </h1>
          <p className="acq__lede">{CASE_QUEUE_INTENT_COPY[mode]}</p>
          <ol className="acq__steps" aria-label="How to decide on a case">
            {CASE_TRIAGE_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          className="acq__button acq__button--ghost"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="acq__stats" aria-label="Queue counts">
        <button
          type="button"
          className={query.state === 'inbox' ? 'is-active' : undefined}
          onClick={() => patchQuery({ state: 'inbox' })}
        >
          Inbox <strong>{counts.inbox}</strong>
        </button>
        <button
          type="button"
          className={query.state === 'candidate' ? 'is-active' : undefined}
          onClick={() => patchQuery({ state: 'candidate' })}
        >
          {filterChipLabel('candidate')} <strong>{counts.candidate}</strong>
        </button>
        <button
          type="button"
          className={query.state === 'relevance_review' ? 'is-active' : undefined}
          onClick={() => patchQuery({ state: 'relevance_review' })}
        >
          {filterChipLabel('relevance_review')} <strong>{counts.relevanceReview}</strong>
        </button>
        <button
          type="button"
          className={query.state === 'insufficient_evidence' ? 'is-active' : undefined}
          onClick={() => patchQuery({ state: 'insufficient_evidence' })}
        >
          {filterChipLabel('insufficient_evidence')} <strong>{counts.needsEvidence}</strong>
        </button>
        {mode === 'cases' ? (
          <button
            type="button"
            className={query.state === 'all' ? 'is-active' : undefined}
            onClick={() => patchQuery({ state: 'all' })}
          >
            {filterChipLabel('all')} <strong>{counts.total}</strong>
          </button>
        ) : null}
      </section>

      <section className="acq__toolbar" aria-label="Filter and sort">
        <label className="acq__field">
          <span>Search</span>
          <input
            type="search"
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="Title, id, place…"
          />
        </label>
        <label className="acq__field">
          <span>Sort</span>
          <select
            value={query.sortKey}
            onChange={(event) =>
              patchQuery({ sortKey: event.target.value as CaseQueueSortKey })
            }
          >
            <option value="updatedAt">Updated</option>
            <option value="title">Title</option>
            <option value="state">State</option>
            <option value="checklist">Checklist</option>
          </select>
        </label>
        <label className="acq__field">
          <span>Direction</span>
          <select
            value={query.sortDirection}
            onChange={(event) =>
              patchQuery({ sortDirection: event.target.value as CaseQueueSortDirection })
            }
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </section>

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
            <input
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
              <button
                key={action}
                type="button"
                className={
                  action === 'exclude'
                    ? 'acq__button'
                    : 'acq__button acq__button--primary'
                }
                title={actionHelp(action)}
                disabled={
                  busy || selectedIds.size > RESEARCH_CASE_BULK_LIMIT || !reason.trim()
                }
                onClick={() => void runTransition(action, [...selectedIds])}
              >
                {actionLabel(action)}
              </button>
            ))}
            <button
              type="button"
              className="acq__button acq__button--ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </section>
      ) : null}

      {visible.length === 0 ? (
        <p className="acq__empty">
          {loading ? 'Loading research cases…' : 'No research cases match this filter.'}
        </p>
      ) : (
        <div className="acq__table-wrap">
          <table className="acq__table">
            <caption className="ds-visually-hidden">
              Research cases: {visible.length} visible
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <label className="acq__checkbox-hit">
                    <input
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
                <th scope="col">Title</th>
                <th scope="col">State</th>
                {showChecklistColumn ? <th scope="col">Checklist</th> : null}
                {showPlaceColumn ? <th scope="col">Place</th> : null}
                <th scope="col">Updated</th>
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
                        <input
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
                      <span className="acq__row-title">{row.title}</span>
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
                    {showPlaceColumn ? (
                      <td>
                        {row.placeHint?.trim() ? (
                          row.placeHint
                        ) : (
                          <span className="acq__not-set">Not set</span>
                        )}
                      </td>
                    ) : null}
                    <td className="acq__updated">{formatWhen(row.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={`acq-sheet-portal${activeId ? ' is-open' : ''}`} aria-hidden={!activeId}>
        {activeId ? (
          <>
            <button
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
                  <Link className="acq__button acq__button--ghost" href={`/cases/${activeId}`}>
                    Open full page
                  </Link>
                  <button
                    ref={closeRef}
                    type="button"
                    className="acq__button acq__button--ghost"
                    onClick={closeSheet}
                  >
                    Close
                  </button>
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
                    Write a decision reason, then choose an action. Available moves for this
                    state:
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
                  <textarea
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
                    <select
                      value={reasonCode}
                      onChange={(event) =>
                        setReasonCode(event.target.value as ResearchCaseReasonCode)
                      }
                    >
                      {EXCLUSION_REASON_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {legalActions.includes('merge') ? (
                  <label className="acq__field acq__field--grow">
                    <span>Merge into case id</span>
                    <input
                      type="text"
                      value={mergeTarget}
                      onChange={(event) => setMergeTarget(event.target.value)}
                      placeholder="Target research case id"
                    />
                  </label>
                ) : null}
                <div className="acq__bulk-actions">
                  {legalActions.map((action) => (
                    <button
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
                    </button>
                  ))}
                  <button
                    type="button"
                    className="acq__button acq__button--ghost"
                    disabled={busy}
                    onClick={() => void assignToMe()}
                  >
                    Assign to me
                  </button>
                </div>
              </footer>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

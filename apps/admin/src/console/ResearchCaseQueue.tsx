/**
 * Client research-case queue: dense selectable table, bulk selection bar, and
 * slide-over detail sheet. Consumes server-provided ConsoleFixtureRow props — no live fetch.
 */
'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ConsoleDataSource, ConsoleFixtureRow } from './model';
import {
  RESEARCH_CASE_QUEUE_BULK_LIMIT,
  allVisibleResearchCasesSelected,
  dataSourceCountLabel,
  formatResearchCaseWhen,
  isEntityLikeTitle,
  parseCandidateIdFromDetail,
  resolveRowUpdatedAt,
  toggleAllResearchCaseSelection,
  toggleResearchCaseSelection,
} from './research-case-queue';
import './research-case-queue.css';

export type ResearchCaseQueueProps = {
  readonly rows: readonly ConsoleFixtureRow[];
  readonly dataSource: ConsoleDataSource;
  readonly surfaceId: 'candidate-queue' | 'research-cases' | string;
};

function sortRowsByUpdated(rows: readonly ConsoleFixtureRow[]): readonly ConsoleFixtureRow[] {
  return [...rows].sort((left, right) =>
    resolveRowUpdatedAt(right).localeCompare(resolveRowUpdatedAt(left)),
  );
}

export function ResearchCaseQueue({ rows, dataSource, surfaceId }: ResearchCaseQueueProps) {
  const sortedRows = useMemo(() => sortRowsByUpdated(rows), [rows]);
  const visibleIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetTitleId = useId();
  const bulkNoteId = useId();

  const activeRow = useMemo(
    () => sortedRows.find((row) => row.id === activeRowId) ?? null,
    [activeRowId, sortedRows],
  );

  const allVisibleSelected = allVisibleResearchCasesSelected(selectedIds, visibleIds);
  const selectionAtLimit = selectedIds.size >= RESEARCH_CASE_QUEUE_BULK_LIMIT;

  const closeSheet = useCallback(() => {
    setActiveRowId(null);
    setCopyStatus(null);
  }, []);

  const openSheet = useCallback((rowId: string) => {
    setActiveRowId(rowId);
    setCopyStatus(null);
  }, []);

  useEffect(() => {
    if (!activeRowId) return;

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeRowId, closeSheet]);

  useEffect(() => {
    if (activeRowId && !activeRow) {
      closeSheet();
    }
  }, [activeRow, activeRowId, closeSheet]);

  function toggleOne(rowId: string) {
    setSelectedIds((current) => toggleResearchCaseSelection(current, rowId));
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      toggleAllResearchCaseSelection(current, visibleIds, !allVisibleSelected),
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function copyCaseId(caseId: string) {
    try {
      await navigator.clipboard.writeText(caseId);
      setCopyStatus(`Copied ${caseId}`);
    } catch {
      setCopyStatus('Copy failed — select the case id manually');
    }
  }

  const countLabel = dataSourceCountLabel(sortedRows.length, dataSource);
  const activeCandidateId = activeRow ? parseCandidateIdFromDetail(activeRow.detail) : null;
  const showCopyCaseId = activeRow ? isEntityLikeTitle(activeRow.title) : false;

  return (
    <div className="rcq" data-surface={surfaceId}>
      <div className="rcq__toolbar" aria-label="Queue selection">
        <label className="rcq__checkbox-hit">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            aria-label="Select all visible research cases"
          />
        </label>
        <p className="rcq__toolbar-count">
          {selectedIds.size} selected
          {selectionAtLimit ? ` (max ${RESEARCH_CASE_QUEUE_BULK_LIMIT})` : ''}
        </p>
        <button
          type="button"
          className="rcq__button rcq__button--ghost"
          onClick={clearSelection}
          disabled={selectedIds.size === 0}
        >
          Clear
        </button>
        <span className="rcq__toolbar-spacer" aria-hidden="true" />
        <p className="rcq__toolbar-meta">{countLabel}</p>
      </div>

      {selectedIds.size > 0 ? (
        <section className="rcq__bulk" aria-label="Bulk actions" aria-describedby={bulkNoteId}>
          <p className="rcq__toolbar-count">
            <strong>{selectedIds.size}</strong> selected
          </p>
          <div className="rcq__bulk-actions">
            <button
              type="button"
              className="rcq__button rcq__button--primary"
              disabled
              aria-disabled="true"
              title="Bulk mutations not connected yet"
            >
              Mark for triage
            </button>
            <button
              type="button"
              className="rcq__button"
              disabled
              aria-disabled="true"
              title="Bulk mutations not connected yet"
            >
              Needs evidence
            </button>
            <button
              type="button"
              className="rcq__button rcq__button--ghost"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
          <p className="rcq__bulk-note" id={bulkNoteId}>
            Bulk mutations not connected yet — selection is ready
          </p>
        </section>
      ) : null}

      {sortedRows.length === 0 ? (
        <p className="rcq__empty">No research cases in this queue.</p>
      ) : (
        <div className="rcq__table-wrap">
          <table className="rcq__table">
            <caption className="ds-visually-hidden">Research case queue: {countLabel}</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="ds-visually-hidden">Select</span>
                </th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const isActive = activeRowId === row.id;
                const isChecked = selectedIds.has(row.id);
                const rowClass = [
                  'rcq__row',
                  isActive ? 'is-selected' : '',
                  isChecked ? 'is-checked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <tr
                    key={row.id}
                    className={rowClass}
                    onClick={() => openSheet(row.id)}
                    aria-selected={isActive}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <label className="rcq__checkbox-hit">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select ${row.title}`}
                          disabled={!isChecked && selectionAtLimit}
                        />
                      </label>
                    </td>
                    <td>
                      <span className="rcq__title">{row.title}</span>
                      <span className="rcq__title-id">{row.id}</span>
                    </td>
                    <td>
                      <span className="rcq__badge">{row.status}</span>
                    </td>
                    <td className="rcq__updated">
                      {formatResearchCaseWhen(resolveRowUpdatedAt(row))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="rcq__foot">{countLabel}</p>

      <div className={`rcq-sheet-portal${activeRow ? ' is-open' : ''}`} aria-hidden={!activeRow}>
        {activeRow ? (
          <>
            <button
              type="button"
              className="rcq-sheet-backdrop"
              aria-label="Close detail panel"
              onClick={closeSheet}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              className="rcq-sheet"
            >
              <header className="rcq-sheet__header">
                <div>
                  <h2 className="rcq-sheet__title" id={sheetTitleId}>
                    {activeRow.title}
                  </h2>
                  <p className="rcq-sheet__meta">{activeRow.id}</p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="rcq__button rcq__button--ghost"
                  onClick={closeSheet}
                >
                  Close
                </button>
              </header>

              <div className="rcq-sheet__body">
                <p className="rcq-sheet__meta">
                  <span className="rcq__badge">{activeRow.status}</span>
                </p>

                <dl className="rcq-sheet__dl">
                  <div>
                    <dt>Case id</dt>
                    <dd className="rcq-sheet__meta">{activeRow.id}</dd>
                  </div>
                  {activeCandidateId ? (
                    <div>
                      <dt>Candidate id</dt>
                      <dd className="rcq-sheet__meta">{activeCandidateId}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Updated</dt>
                    <dd className="rcq-sheet__meta">
                      {formatResearchCaseWhen(resolveRowUpdatedAt(activeRow))}
                    </dd>
                  </div>
                </dl>

                <div>
                  <p className="rcq-sheet__meta">Detail</p>
                  <p className="rcq-sheet__detail">{activeRow.detail}</p>
                </div>

                {isEntityLikeTitle(activeRow.title) ? (
                  <p className="rcq-sheet__notice" role="note">
                    Private research case — nothing public yet. Use the case id for operator
                    handoffs; do not link to a public entity page.
                  </p>
                ) : null}
              </div>

              <footer className="rcq-sheet__footer">
                {showCopyCaseId ? (
                  <button
                    type="button"
                    className="rcq__button rcq__button--primary"
                    onClick={() => void copyCaseId(activeRow.id)}
                  >
                    Copy case id
                  </button>
                ) : null}
                {copyStatus ? (
                  <p className="rcq-sheet__copy-status" role="status" aria-live="polite">
                    {copyStatus}
                  </p>
                ) : null}
              </footer>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

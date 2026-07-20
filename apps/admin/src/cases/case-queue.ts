/**
 * Pure helpers for admin research-case queues: filter, sort, selection, action labels.
 */
import type { ResearchCaseState } from '@repo/domain';
import {
  legalActionsForState,
  stateLabel,
  type AdminCaseListItem,
  type AdminCaseTransitionAction,
} from './research-case-types';

export const RESEARCH_CASE_BULK_LIMIT = 50;

export type CaseQueueSortKey = 'updatedAt' | 'title' | 'state' | 'checklist';
export type CaseQueueSortDirection = 'asc' | 'desc';

export type CaseQueueQuery = {
  readonly search: string;
  readonly state: ResearchCaseState | 'all' | 'inbox';
  readonly sortKey: CaseQueueSortKey;
  readonly sortDirection: CaseQueueSortDirection;
};

export const DEFAULT_CASE_QUEUE_QUERY: CaseQueueQuery = {
  search: '',
  state: 'inbox',
  sortKey: 'updatedAt',
  sortDirection: 'desc',
};

export function actionLabel(action: AdminCaseTransitionAction): string {
  switch (action) {
    case 'send_to_relevance':
      return 'Send to relevance';
    case 'confirm_relevance':
      return 'Confirm relevance';
    case 'needs_evidence':
      return 'Needs evidence';
    case 'exclude':
      return 'Exclude';
    case 'merge':
      return 'Merge';
  }
}

export function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function applyCaseQueue(
  rows: readonly AdminCaseListItem[],
  query: CaseQueueQuery,
): readonly AdminCaseListItem[] {
  const search = query.search.trim().toLowerCase();
  let filtered = rows.filter((row) => {
    if (query.state === 'inbox') {
      if (
        row.state !== 'candidate' &&
        row.state !== 'relevance_review' &&
        row.state !== 'insufficient_evidence'
      ) {
        return false;
      }
    } else if (query.state !== 'all' && row.state !== query.state) {
      return false;
    }
    if (!search) return true;
    const haystack = [
      row.title,
      row.id,
      row.candidateId,
      row.state,
      stateLabel(row.state),
      row.placeHint ?? '',
      row.assigneeId ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });

  filtered = [...filtered].sort((left, right) => {
    let cmp: number;
    switch (query.sortKey) {
      case 'title':
        cmp = left.title.localeCompare(right.title);
        break;
      case 'state':
        cmp = left.state.localeCompare(right.state);
        break;
      case 'checklist': {
        const leftRatio =
          left.checklistTotal === 0 ? 0 : left.checklistComplete / left.checklistTotal;
        const rightRatio =
          right.checklistTotal === 0 ? 0 : right.checklistComplete / right.checklistTotal;
        cmp = leftRatio - rightRatio;
        break;
      }
      case 'updatedAt':
      default:
        cmp = left.updatedAt.localeCompare(right.updatedAt);
        break;
    }
    return query.sortDirection === 'asc' ? cmp : -cmp;
  });

  return filtered;
}

export function countCaseQueue(rows: readonly AdminCaseListItem[]): {
  readonly total: number;
  readonly inbox: number;
  readonly candidate: number;
  readonly relevanceReview: number;
  readonly needsEvidence: number;
  readonly excluded: number;
} {
  return {
    total: rows.length,
    inbox: rows.filter(
      (row) =>
        row.state === 'candidate' ||
        row.state === 'relevance_review' ||
        row.state === 'insufficient_evidence',
    ).length,
    candidate: rows.filter((row) => row.state === 'candidate').length,
    relevanceReview: rows.filter((row) => row.state === 'relevance_review').length,
    needsEvidence: rows.filter((row) => row.state === 'insufficient_evidence').length,
    excluded: rows.filter((row) => row.state === 'excluded').length,
  };
}

export function toggleCaseSelection(
  selected: ReadonlySet<string>,
  caseId: string,
  limit = RESEARCH_CASE_BULK_LIMIT,
): ReadonlySet<string> {
  const next = new Set(selected);
  if (next.has(caseId)) {
    next.delete(caseId);
    return next;
  }
  if (next.size >= limit) return next;
  next.add(caseId);
  return next;
}

export function toggleAllCaseSelection(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
  selectAll: boolean,
  limit = RESEARCH_CASE_BULK_LIMIT,
): ReadonlySet<string> {
  if (!selectAll) {
    const next = new Set(selected);
    for (const id of visibleIds) next.delete(id);
    return next;
  }
  const next = new Set(selected);
  for (const id of visibleIds) {
    if (next.size >= limit) break;
    next.add(id);
  }
  return next;
}

export function commonActionsForSelection(
  rows: readonly AdminCaseListItem[],
  selectedIds: ReadonlySet<string>,
): readonly AdminCaseTransitionAction[] {
  const selected = rows.filter((row) => selectedIds.has(row.id));
  if (selected.length === 0) return [];
  let common: Set<AdminCaseTransitionAction> | null = null;
  for (const row of selected) {
    const actions = new Set(legalActionsForState(row.state));
    if (!common) {
      common = actions;
      continue;
    }
    for (const action of [...common]) {
      if (!actions.has(action)) common.delete(action);
    }
  }
  return common ? [...common] : [];
}

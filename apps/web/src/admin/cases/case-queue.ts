/**
 * Pure helpers for admin research-case queues: selection and action labels. Filtering, sorting and
 * paging resolve in SQL (see `case-query-params.ts`).
 */
import {
  legalActionsForState,
  type AdminCaseListItem,
  type AdminCaseTransitionAction,
} from './research-case-types';

export const RESEARCH_CASE_BULK_LIMIT = 50;

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

export { formatWhen } from '../lib/format-when';

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

/**
 * Case-queue query vocabulary shared by the SQL layer and the client queue.
 *
 * Kept free of `pg` on purpose: `CaseQueue` is a client component and reads these constants and
 * types, so anything it can reach must not pull the database driver into the browser bundle.
 */

export const CASE_SORT_KEYS = ['updated', 'created', 'title', 'state', 'checklist'] as const;
export type CaseSortKey = (typeof CASE_SORT_KEYS)[number];
export type CaseAssigneeFilter = 'any' | 'assigned' | 'unassigned';

export type CaseQuery = {
  readonly search?: string;
  readonly states?: readonly string[];
  readonly assignee?: CaseAssigneeFilter;
  readonly sort?: CaseSortKey;
  readonly direction?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
};

export type CaseListRow = {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly candidateId: string;
  readonly assigneeId?: string;
  readonly checklistComplete: number;
  readonly checklistTotal: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CasePage = {
  readonly rows: readonly CaseListRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
};

export type CaseStateBucket = { readonly value: string; readonly count: number };

export const CASE_DEFAULT_PAGE_SIZE = 50;
const CASE_MAX_PAGE_SIZE = 200;

export function normalizeCasePageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return CASE_DEFAULT_PAGE_SIZE;
  return Math.min(CASE_MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

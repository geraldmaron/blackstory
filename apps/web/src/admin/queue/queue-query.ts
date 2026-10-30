/**
 * Queue vocabulary and URL codec. Free of `pg` so the client table can import the types.
 *
 * The Queue is one list over four kinds of open work: research cases (one row per candidate),
 * leads (submissions with no case yet), story packets awaiting a finished review, and the viewer's
 * own management requests that need them. Membership, visibility and ordering are specified in
 * docs/plans/admin-footprint-console.md ("Phase 4: Queue contract"); queue-store.ts implements it.
 */
import {
  DESK_DEFAULT_PAGE_SIZE,
  normalizeDeskPageSize,
  readMany,
  readOne,
  readPositiveInt,
  toggleValue,
  type QueryParamInput,
} from '../lib/desk-query';

export const QUEUE_TYPES = ['case', 'lead', 'packet', 'request'] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

export const QUEUE_STAGES = ['triage', 'needs_evidence', 'in_research', 'ready', 'stuck'] as const;
export type QueueStage = (typeof QUEUE_STAGES)[number];

/** Age bands by how long an item has waited in its current state. */
export const QUEUE_AGE_BANDS = ['under_7d', '7_30d', '30_90d', 'over_90d'] as const;
export type QueueAgeBand = (typeof QUEUE_AGE_BANDS)[number];

/** Assignment applies to cases only; other types are "not assignable", never "unassigned". */
export const QUEUE_ASSIGNEE_FILTERS = ['assigned', 'unassigned'] as const;
export type QueueAssigneeFilter = (typeof QUEUE_ASSIGNEE_FILTERS)[number];

export const QUEUE_TYPE_LABELS: Readonly<Record<QueueType, string>> = {
  case: 'Research case',
  lead: 'Lead',
  packet: 'Story packet',
  request: 'Request',
};

export const QUEUE_STAGE_LABELS: Readonly<Record<QueueStage, string>> = {
  triage: 'Triage',
  needs_evidence: 'Needs evidence',
  in_research: 'In research',
  ready: 'Ready to decide',
  stuck: 'Stuck',
};

export const QUEUE_AGE_BAND_LABELS: Readonly<Record<QueueAgeBand, string>> = {
  under_7d: 'Under 7 days',
  '7_30d': '7 to 30 days',
  '30_90d': '30 to 90 days',
  over_90d: 'Over 90 days',
};

export type QueueQuery = {
  readonly search?: string;
  readonly types?: readonly QueueType[];
  readonly stages?: readonly QueueStage[];
  readonly ageBands?: readonly QueueAgeBand[];
  readonly assignee?: QueueAssigneeFilter | undefined;
  readonly page?: number;
  readonly pageSize?: number;
};

export type QueueRow = {
  readonly type: QueueType;
  /** The row's identity within its type: the candidate id for a case, else the native id. */
  readonly id: string;
  /** The record the row opens: the most recently updated open case, the intake item, the work. */
  readonly nativeId: string;
  readonly title: string;
  readonly nativeState: string;
  readonly stage: QueueStage;
  /** ISO time the item entered its current state; for requests, its last activity. */
  readonly waitingSince: string;
  readonly ageBand: QueueAgeBand;
  /** Present only for cases with a reviewer. */
  readonly assigneeId?: string;
  /** Open cases for the candidate; more than one means duplicate research of one candidate. */
  readonly openCaseCount: number;
  readonly href: string;
};

function pick<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

export function parseQueueQuery(input: QueryParamInput): QueueQuery {
  const search = readOne(input, 'q')?.trim();
  const types = pick(readMany(input, 'type'), QUEUE_TYPES);
  const stages = pick(readMany(input, 'stage'), QUEUE_STAGES);
  const ageBands = pick(readMany(input, 'age'), QUEUE_AGE_BANDS);
  const assigneeRaw = readOne(input, 'assignee');
  const assignee = pick(assigneeRaw ? [assigneeRaw] : [], QUEUE_ASSIGNEE_FILTERS)[0];
  return {
    ...(search ? { search } : {}),
    ...(types.length ? { types } : {}),
    ...(stages.length ? { stages } : {}),
    ...(ageBands.length ? { ageBands } : {}),
    ...(assignee ? { assignee } : {}),
    page: readPositiveInt(input, 'page') ?? 1,
    pageSize: normalizeDeskPageSize(readPositiveInt(input, 'size')),
  };
}

export function serializeQueueQuery(query: QueueQuery): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('q', query.search.trim());
  if (query.types?.length) params.set('type', query.types.join(','));
  if (query.stages?.length) params.set('stage', query.stages.join(','));
  if (query.ageBands?.length) params.set('age', query.ageBands.join(','));
  if (query.assignee) params.set('assignee', query.assignee);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== DESK_DEFAULT_PAGE_SIZE) {
    params.set('size', String(query.pageSize));
  }
  return params.toString();
}

/** Any change other than the page resets to page 1, as on every other desk. */
export function queueQueryHref(
  basePath: string,
  query: QueueQuery,
  patch: Partial<QueueQuery>,
): string {
  const resetsPage = Object.keys(patch).some((key) => key !== 'page');
  const serialized = serializeQueueQuery({
    ...query,
    ...patch,
    ...(resetsPage ? { page: 1 } : {}),
  });
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function toggleQueueFacetHref(
  basePath: string,
  query: QueueQuery,
  key: 'types' | 'stages' | 'ageBands',
  value: string,
): string {
  return queueQueryHref(basePath, query, { [key]: toggleValue(query[key], value) });
}

export function hasActiveQueueFilters(query: QueueQuery): boolean {
  return Boolean(
    query.search?.trim() ||
    query.types?.length ||
    query.stages?.length ||
    query.ageBands?.length ||
    query.assignee,
  );
}

/** Where each row type is decided. The Queue lists and routes; it never decides. */
export function queueRowHref(type: QueueType, nativeId: string): string {
  const id = encodeURIComponent(nativeId);
  switch (type) {
    case 'case':
      return `/admin/cases/${id}`;
    case 'lead':
      return `/admin/submissions/${id}`;
    case 'packet':
      return `/admin/stories/review/${id}`;
    case 'request':
      return `/admin/work/${id}`;
  }
}

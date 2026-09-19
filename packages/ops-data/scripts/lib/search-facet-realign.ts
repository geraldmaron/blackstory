/**
 * Shared search realignment engine configured by TARGET_REGISTRY. Supports projection
 * arrays/scalars, topics, status and evidence inputs. Topic selection uses
 * searchTopicsFromProjection; evidence inputs use the domain projector. Inspect conflicts
 * before opting into destructive replacement.
 */
import { recordEvidenceInputs } from '@repo/domain';
import type { EvidenceInputClaim } from '@repo/domain';
import { searchTopicsFromProjection } from './projection-divergence.ts';

/** Minimal query surface this module needs — satisfied by `pg.Client`, `Pool`, and `PoolClient`. */
export type SearchFacetRealignClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: T[]; readonly rowCount?: number | null }>;
};

export type SearchFacetRealignTarget =
  | { readonly mode: 'array-facet'; readonly key: string }
  | { readonly mode: 'scalar-facet'; readonly facetKey: string; readonly projectionKey: string }
  | { readonly mode: 'topics-column' }
  | { readonly mode: 'status-column' }
  | { readonly mode: 'evidence-inputs' };

/**
 * `FACET_KEYS` entries the CLI scripts accept, and how each is realigned. Keys are looked up as
 * plain object properties, never interpolated into SQL, so unlike the array-only realigner this
 * replaces there is no identifier-shaped-string validation to do.
 */
export const TARGET_REGISTRY: Readonly<Record<string, SearchFacetRealignTarget>> = {
  topicIds: { mode: 'array-facet', key: 'topicIds' },
  mentionedEntityIds: { mode: 'array-facet', key: 'mentionedEntityIds' },
  notabilityBasis: { mode: 'array-facet', key: 'notabilityBasis' },
  notabilityLabels: { mode: 'array-facet', key: 'notabilityLabels' },
  eraBuckets: { mode: 'array-facet', key: 'eraBuckets' },
  summary: { mode: 'scalar-facet', facetKey: 'summary', projectionKey: 'summary' },
  jurisdictionState: {
    mode: 'scalar-facet',
    facetKey: 'jurisdictionState',
    projectionKey: 'jurisdictionLabel',
  },
  topics: { mode: 'topics-column' },
  status: { mode: 'status-column' },
  evidenceInputs: { mode: 'evidence-inputs' },
};

/** Array facets the search-doc reader can only get from `facets`; the historical default scope. */
export const DEFAULT_ARRAY_KEYS = [
  'topicIds',
  'mentionedEntityIds',
  'notabilityBasis',
  'notabilityLabels',
] as const;

export type SearchFacetRealignRow = {
  readonly entityId: string;
  readonly kind: string;
  readonly facets: Record<string, unknown>;
  readonly status: string | null;
  readonly topics: readonly string[] | null;
  readonly projection: Record<string, unknown>;
};

type RawRow = {
  readonly entity_id: string;
  readonly kind: string;
  readonly facets: unknown;
  readonly status: string | null;
  readonly topics: unknown;
  readonly projection: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isNonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/** Trimmed non-empty text, or `undefined` for anything else — a whitespace-only value is absent. */
function nonEmptyText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => jsonEqual(entry, b[index]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((key, index) => key !== bKeys[index])) {
      return false;
    }
    return aKeys.every((key) =>
      jsonEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return false;
}

/**
 * Whether a field is missing on both sides, only on the search-doc side (a gap this backfill can
 * fill), only on the projection side (never touched — the facet has substance the projection
 * lacks), or present on both sides and disagreeing.
 */
export type FieldClassification = 'unchanged' | 'stale' | 'differ' | 'facet-only';

function classify(
  desiredPresent: boolean,
  currentPresent: boolean,
  equalWhenBothPresent: boolean,
): FieldClassification {
  if (!desiredPresent && !currentPresent) return 'unchanged';
  if (desiredPresent && !currentPresent) return 'stale';
  if (!desiredPresent && currentPresent) return 'facet-only';
  return equalWhenBothPresent ? 'unchanged' : 'differ';
}

type TargetOutcome = {
  readonly classification: FieldClassification;
  /** What would be written if this outcome is applied. Only meaningful when writable. */
  readonly desiredValue: unknown;
};

/** Modes whose mismatch is always corrected, never merely reported. See the module header. */
const ALWAYS_RESOLVE_MODES: ReadonlySet<SearchFacetRealignTarget['mode']> = new Set([
  'status-column',
  'evidence-inputs',
]);

function evaluateArrayFacet(row: SearchFacetRealignRow, key: string): TargetOutcome {
  const desired = row.projection[key];
  const current = row.facets[key];
  const desiredPresent = isNonEmptyArray(desired);
  const currentPresent = isNonEmptyArray(current);
  const classification = classify(
    desiredPresent,
    currentPresent,
    desiredPresent && currentPresent && jsonEqual(desired, current),
  );
  return { classification, desiredValue: desiredPresent ? desired : undefined };
}

function evaluateScalarFacet(
  row: SearchFacetRealignRow,
  facetKey: string,
  projectionKey: string,
): TargetOutcome {
  const desired = nonEmptyText(row.projection[projectionKey]);
  const current = nonEmptyText(row.facets[facetKey]);
  const classification = classify(
    desired !== undefined,
    current !== undefined,
    desired !== undefined && current !== undefined && desired === current,
  );
  return { classification, desiredValue: desired };
}

/**
 * Compare selected topics as sets using the same rule as publication. Do not rewrite rows
 * solely because array order differs.
 */
function evaluateTopicsColumn(row: SearchFacetRealignRow): TargetOutcome {
  const desired = searchTopicsFromProjection(row.projection);
  const desiredPresent = desired.length > 0;
  const currentPresent = isNonEmptyArray(row.topics);
  const current = Array.isArray(row.topics)
    ? row.topics.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const classification = classify(
    desiredPresent,
    currentPresent,
    desiredPresent && currentPresent && jsonEqual([...desired].sort(), [...current].sort()),
  );
  return { classification, desiredValue: desiredPresent ? [...desired] : undefined };
}

/** `mapPostgresSearchIndexRow`'s own precedence: the `status` column first, then `facets.status`. */
function currentStatus(row: SearchFacetRealignRow): string | undefined {
  return nonEmptyText(row.status) ?? nonEmptyText(row.facets.status);
}

function evaluateStatusColumn(row: SearchFacetRealignRow): TargetOutcome {
  const desired = nonEmptyText(row.projection.status);
  const current = currentStatus(row);
  const classification = classify(
    desired !== undefined,
    current !== undefined,
    desired !== undefined && current !== undefined && desired === current,
  );
  return { classification, desiredValue: desired };
}

function asClaimsForEvidenceInputs(value: unknown): readonly EvidenceInputClaim[] {
  return Array.isArray(value) ? value : [];
}

function evaluateEvidenceInputs(row: SearchFacetRealignRow): TargetOutcome {
  const desired = recordEvidenceInputs(asClaimsForEvidenceInputs(row.projection.claims));
  const current = row.facets.evidenceInputs;
  // The projection always exists (a total function over `[]`), so an absent current value is
  // filled the same way a differing one is corrected — there is no "facet-only" case here,
  // matching what the confidence target it replaced already did. Lineage keys are compared in
  // order because `recordEvidenceInputs` emits them in first-seen claim order on both sides.
  const classification: FieldClassification = jsonEqual(desired, current)
    ? 'unchanged'
    : current === undefined || current === null
      ? 'stale'
      : 'differ';
  return { classification, desiredValue: desired };
}

function evaluate(target: SearchFacetRealignTarget, row: SearchFacetRealignRow): TargetOutcome {
  switch (target.mode) {
    case 'array-facet':
      return evaluateArrayFacet(row, target.key);
    case 'scalar-facet':
      return evaluateScalarFacet(row, target.facetKey, target.projectionKey);
    case 'topics-column':
      return evaluateTopicsColumn(row);
    case 'status-column':
      return evaluateStatusColumn(row);
    case 'evidence-inputs':
      return evaluateEvidenceInputs(row);
  }
}

function shouldWrite(
  mode: SearchFacetRealignTarget['mode'],
  classification: FieldClassification,
  resolveConflicts: boolean,
): boolean {
  if (classification === 'stale') return true;
  if (classification === 'differ') return ALWAYS_RESOLVE_MODES.has(mode) || resolveConflicts;
  return false;
}

export type SearchFacetRealignTargetReport = {
  readonly key: string;
  readonly mode: SearchFacetRealignTarget['mode'];
  /** Rows with no current value, now filled. */
  readonly filled: number;
  /** Rows where both sides disagreed and this run resolved it toward the projection. */
  readonly resolved: number;
  /** Rows where both sides disagreed and this run left it alone (needs `resolveConflicts`). */
  readonly leftConflicts: number;
  /** Rows where the facet/column already carries a value the projection lacks — never touched. */
  readonly facetOnly: number;
};

export type SearchFacetRealignChange = {
  readonly entityId: string;
  readonly kind: string;
  /** Keys to merge into `facets` (a shallow, top-level merge — every target here is top-level). */
  readonly facetsPatch: Readonly<Record<string, unknown>>;
  readonly statusColumn?: string | undefined;
  readonly topicsColumn?: readonly string[] | undefined;
};

export type SearchFacetRealignPlan = {
  readonly scanned: number;
  readonly kind: string | undefined;
  readonly targets: readonly SearchFacetRealignTargetReport[];
  readonly changes: readonly SearchFacetRealignChange[];
};

export type SearchFacetRealignOptions = {
  readonly keys: readonly string[];
  readonly kind?: string | undefined;
  /** Mirrors every script's own `OVERWRITE_CONFLICTS` env var. Ignored for always-resolve modes. */
  readonly resolveConflicts?: boolean;
};

/**
 * Computes what would change for every requested key, without writing anything. Always the first
 * call — dry-run is simply calling this and not calling `applySearchFacetRealign`.
 */
export async function planSearchFacetRealign(
  client: SearchFacetRealignClient,
  options: SearchFacetRealignOptions,
): Promise<SearchFacetRealignPlan> {
  const requestedTargets: { readonly key: string; readonly target: SearchFacetRealignTarget }[] =
    [];
  for (const key of options.keys) {
    const target = TARGET_REGISTRY[key];
    if (target === undefined) {
      throw new Error(`Unknown search-facet realign key: ${JSON.stringify(key)}`);
    }
    requestedTargets.push({ key, target });
  }
  if (options.keys.length === 0) throw new Error('planSearchFacetRealign: keys must be non-empty');

  const params: unknown[] = [];
  let kindClause = '';
  if (options.kind !== undefined) {
    params.push(options.kind);
    kindClause = ` AND si.kind = $${params.length}`;
  }

  const { rows } = await client.query<RawRow>(
    `SELECT si.entity_id, si.kind, si.facets, si.status, si.topics, re.projection
       FROM published.search_index si
       JOIN published.v_active_release_id r ON r.release_id = si.release_id
       JOIN published.release_entities re
         ON re.release_id = si.release_id AND re.entity_id = si.entity_id
      WHERE si.release_id = r.release_id
        AND jsonb_typeof(si.facets) = 'object'${kindClause}
      ORDER BY si.entity_id`,
    params,
  );

  const rowsNormalized: readonly SearchFacetRealignRow[] = rows.map((row) => ({
    entityId: row.entity_id,
    kind: row.kind,
    facets: asRecord(row.facets),
    status: row.status,
    topics: Array.isArray(row.topics) ? (row.topics as readonly string[]) : null,
    projection: asRecord(row.projection),
  }));

  const changesByEntity = new Map<
    string,
    {
      readonly kind: string;
      facetsPatch: Record<string, unknown>;
      statusColumn?: string;
      topicsColumn?: readonly string[];
    }
  >();
  const targetReports: SearchFacetRealignTargetReport[] = [];
  const resolveConflicts = options.resolveConflicts === true;

  for (const { key, target } of requestedTargets) {
    let filled = 0;
    let resolved = 0;
    let leftConflicts = 0;
    let facetOnly = 0;

    for (const row of rowsNormalized) {
      const outcome = evaluate(target, row);
      if (outcome.classification === 'facet-only') {
        facetOnly += 1;
        continue;
      }
      if (outcome.classification === 'unchanged') continue;

      const write = shouldWrite(target.mode, outcome.classification, resolveConflicts);
      if (outcome.classification === 'stale' && write) filled += 1;
      if (outcome.classification === 'differ') {
        if (write) resolved += 1;
        else leftConflicts += 1;
      }
      if (!write) continue;

      const entry = changesByEntity.get(row.entityId) ?? { kind: row.kind, facetsPatch: {} };
      if (target.mode === 'topics-column') {
        entry.topicsColumn = outcome.desiredValue as readonly string[];
      } else if (target.mode === 'status-column') {
        entry.statusColumn = outcome.desiredValue as string;
        entry.facetsPatch.status = outcome.desiredValue;
      } else if (target.mode === 'array-facet') {
        entry.facetsPatch[target.key] = outcome.desiredValue;
      } else if (target.mode === 'scalar-facet') {
        entry.facetsPatch[target.facetKey] = outcome.desiredValue;
      } else if (target.mode === 'evidence-inputs') {
        entry.facetsPatch.evidenceInputs = outcome.desiredValue;
      }
      changesByEntity.set(row.entityId, entry);
    }

    targetReports.push({ key, mode: target.mode, filled, resolved, leftConflicts, facetOnly });
  }

  const changes: SearchFacetRealignChange[] = [...changesByEntity.entries()].map(
    ([entityId, entry]) => ({
      entityId,
      kind: entry.kind,
      facetsPatch: entry.facetsPatch,
      statusColumn: entry.statusColumn,
      topicsColumn: entry.topicsColumn,
    }),
  );

  return { scanned: rowsNormalized.length, kind: options.kind, targets: targetReports, changes };
}

/**
 * Applies a previously computed plan. One `UPDATE` per changed row, merging every requested
 * key's patch together so a row touched by two targets (e.g. `summary` and `topics` in the same
 * run) is written once.
 */
export async function applySearchFacetRealign(
  client: SearchFacetRealignClient,
  plan: SearchFacetRealignPlan,
): Promise<number> {
  let updated = 0;
  for (const change of plan.changes) {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (Object.keys(change.facetsPatch).length > 0) {
      params.push(JSON.stringify(change.facetsPatch));
      setClauses.push(`facets = si.facets || $${params.length}::jsonb`);
    }
    if (change.statusColumn !== undefined) {
      params.push(change.statusColumn);
      setClauses.push(`status = $${params.length}`);
    }
    if (change.topicsColumn !== undefined) {
      params.push(change.topicsColumn as string[]);
      setClauses.push(`topics = $${params.length}::text[]`);
    }
    if (setClauses.length === 0) continue;

    params.push(change.entityId);
    const entityParamIndex = params.length;
    const result = await client.query(
      `UPDATE published.search_index si
          SET ${setClauses.join(', ')}
         FROM published.v_active_release_id r
        WHERE si.release_id = r.release_id
          AND si.entity_id = $${entityParamIndex}`,
      params,
    );
    updated += result.rowCount ?? 1;
  }
  return updated;
}

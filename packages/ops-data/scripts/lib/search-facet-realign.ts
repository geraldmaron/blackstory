/**
 * Shared engine behind the `backfill-search-facets-*.ts` scripts: realigns
 * `bb_public.search_index` from the active release's projection, which every one of those scripts
 * treats as the sole authority. Two families of write target are supported — an array copied into
 * a `facets` key, and a scalar copied into a `facets` key or a plain column — and this module is
 * the one place both are decided. Each of the five CLI scripts
 * (`backfill-search-facets-projection.ts`/`-era.ts`/`-jurisdiction.ts`/`-status.ts`/
 * `-confidence.ts`) configures it for its own key(s) and prints the result.
 *
 * TARGET REGISTRY
 * `TARGET_REGISTRY` maps a `FACET_KEYS` entry to how it is sourced, compared, and written:
 *   - 'array-facet'     copies a same-named projection array into the same-named `facets` key
 *                       (`eraBuckets`, `topicIds`, `mentionedEntityIds`, `notabilityBasis`,
 *                       `notabilityLabels`).
 *   - 'scalar-facet'    copies a projection scalar into a `facets` key; the two names may differ
 *                       (`jurisdictionLabel` -> `jurisdictionState`; `summary` -> `summary`).
 *   - 'topics-column'   copies `projection.topicIds` into the `topics` COLUMN, not a `facets` key.
 *                       `mapPostgresSearchIndexRow` (`packages/schemas/src/search-index-row.ts`)
 *                       reads the column first, falling back to `facets.topicTags`, so a facets
 *                       write here would never be read back.
 *   - 'status-column'   copies `projection.status` into BOTH the `status` COLUMN and
 *                       `facets.status`, and resolves ANY mismatch rather than only an empty one.
 *                       `mapPostgresSearchIndexRow` prefers the column, so a stale column value
 *                       serves a wrong status even with a correct facet sitting next to it, and a
 *                       record showing "living" on stale data is exactly what must not stand.
 *   - 'confidence-tier' recomputes `facets.confidenceTier` with `highestClaimConfidenceTier`
 *                       (`@repo/domain`) — the same rule the release builder grades records with
 *                       — rather than copying a projection field verbatim: nothing in the
 *                       projection already carries the graded tier, and reusing the production
 *                       function (instead of restating its lineage/corroboration rules a third
 *                       time) is what keeps this backfill and the release builder agreeing about
 *                       which records rate which grade.
 *
 * ONE-DIRECTIONAL BY DEFAULT
 * Every target except 'status-column' and 'confidence-tier' only fills a gap: a row whose facet
 * (or column) already carries a value is left alone unless `resolveConflicts` is passed, matching
 * every array/scalar script's own `OVERWRITE_CONFLICTS` convention. 'status-column' and
 * 'confidence-tier' always resolve a mismatch, matching what `backfill-search-facets-status.ts`
 * and `backfill-search-facets-confidence.ts` already do today — neither ever had a fill-only
 * mode, because both guard an assertion (nobody is "living" without evidence; the graded tier is
 * derived, not asserted) rather than copy a value nobody disputes.
 *
 * Read-only until `applySearchFacetRealign` is called: `planSearchFacetRealign` never writes.
 */
import { highestClaimConfidenceTier } from '@repo/domain';

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
  | { readonly mode: 'confidence-tier' };

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
  confidenceTier: { mode: 'confidence-tier' },
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
  'confidence-tier',
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

function evaluateTopicsColumn(row: SearchFacetRealignRow): TargetOutcome {
  const rawIds = row.projection.topicIds;
  const desiredIds = Array.isArray(rawIds)
    ? rawIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const desiredPresent = desiredIds.length > 0;
  const currentPresent = isNonEmptyArray(row.topics);
  const classification = classify(
    desiredPresent,
    currentPresent,
    desiredPresent && currentPresent && jsonEqual(desiredIds, row.topics),
  );
  return { classification, desiredValue: desiredPresent ? desiredIds : undefined };
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

function asClaimsForConfidence(value: unknown): readonly {
  readonly confidenceLevel?: string;
  readonly citationSource?: string;
  readonly predicate?: string;
  readonly claimRole?: string;
}[] {
  return Array.isArray(value) ? value : [];
}

function evaluateConfidenceTier(row: SearchFacetRealignRow): TargetOutcome {
  const desired = highestClaimConfidenceTier(asClaimsForConfidence(row.projection.claims));
  const current = nonEmptyText(row.facets.confidenceTier);
  const equal = current === desired;
  // The computed tier always exists (a total function over `[]` is `'unrated'`), so an absent
  // current value is filled the same way a differing one is corrected — there is no "facet-only"
  // case here, matching `backfill-search-facets-confidence.ts` today.
  const classification: FieldClassification = equal
    ? 'unchanged'
    : current === undefined
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
    case 'confidence-tier':
      return evaluateConfidenceTier(row);
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
  readonly statusColumn?: string;
  readonly topicsColumn?: readonly string[];
};

export type SearchFacetRealignPlan = {
  readonly scanned: number;
  readonly kind: string | undefined;
  readonly targets: readonly SearchFacetRealignTargetReport[];
  readonly changes: readonly SearchFacetRealignChange[];
};

export type SearchFacetRealignOptions = {
  readonly keys: readonly string[];
  readonly kind?: string;
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
  for (const key of options.keys) {
    if (!(key in TARGET_REGISTRY)) {
      throw new Error(`Unknown search-facet realign key: ${JSON.stringify(key)}`);
    }
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
       FROM bb_public.search_index si
       JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
       JOIN bb_public.release_entities re
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

  for (const key of options.keys) {
    const target = TARGET_REGISTRY[key];
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
      } else if (target.mode === 'confidence-tier') {
        entry.facetsPatch.confidenceTier = outcome.desiredValue;
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
      `UPDATE bb_public.search_index si
          SET ${setClauses.join(', ')}
         FROM bb_public.v_active_release_id r
        WHERE si.release_id = r.release_id
          AND si.entity_id = $${entityParamIndex}`,
      params,
    );
    updated += result.rowCount ?? 1;
  }
  return updated;
}

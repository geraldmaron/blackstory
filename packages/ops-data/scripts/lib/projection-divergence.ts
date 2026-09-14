/**
 * Compares `bb_public.release_entities.projection` against every derived copy of the same facts.
 *
 * Public readers serve the projection jsonb and nothing else — `fetchPublicEntityProjection`,
 * `listPublicEntityProjections` and `fetchPublicEntityProjectionsByIds` in
 * `apps/web/src/lib/public-data/postgres-readers.ts`, and the `apps/api-public` twin, all SELECT
 * `projection`. Every other store of those facts is derived and invisible to a reader:
 *
 *   - the columns on the same `release_entities` row (`summary`, `location`, `lat`, `lng`,
 *     `geohash`, `claims`, `related`, `taxonomy`, `primary_image`, `kind`, `display_name`),
 *     written from the projection by `toReleaseEntityRow` in `lib/incremental-publish.ts`;
 *   - `bb_public.search_index` (`kind`, `status`, `topics`, `facets`), written from the same
 *     build by `toSearchIndexRow`.
 *
 * A write that lands on one store and not the other leaves readers serving the older value while
 * an operator reads the newer one back out of the column and calls the work done. That has
 * happened repeatedly, each time silently, which is why the comparison lives in one module: an
 * audit run and a post-apply check cannot then disagree about what "in sync" means.
 *
 * SCOPE — only facts the projection actually carries. `search_index.recordMaturity`,
 * `evidenceInputs`, `relatedCount`, `claimCount` and `aliases` are computed by the release
 * builder from inputs the projection does not restate, so there is nothing here to compare them
 * against and they are deliberately absent. `facets.summary` is absent for the same reason
 * `toSearchIndexRow` omits it: an index-size decision, not drift.
 *
 * A SECOND KIND OF DRIFT, added for repo-rm2y: a field can agree with every copy of itself and
 * still be stale, because all of them were written from a version of the record that no longer
 * exists. `notabilityBasis`, `notabilityLabels` and `researchCoverage` are DERIVED from the
 * record's own claims, and five scripts rewrite `projection.claims` in place without recomputing
 * any of them — which is how three records ended up publishing an inclusion reason whose evidence
 * pointed at claim ids the record no longer carried. The `builder.*` checks below recompute those
 * three from the projection and report a row the recompute would move, so the audit's existing
 * exit-code-1 contract covers staleness as well as disagreement.
 *
 * READ-ONLY: this module opens no write path.
 */
import { isDeepStrictEqual } from 'node:util';
import { computeReleaseResearchCoverage } from '@repo/domain';
import type { Pool, PoolClient } from 'pg';
import {
  notabilityBasisIsConverged,
  notabilityLabelsForBasis,
  toBasisRecords,
  toClaimProjections,
} from './notability-basis-resync.ts';

type Rec = Readonly<Record<string, unknown>>;

/** One release row joined to its search-index twin. Shapes match the SELECT below. */
export type ProjectionDivergenceDbRow = {
  readonly entity_id: string;
  readonly display_name: string | null;
  readonly kind: string | null;
  readonly summary: string | null;
  readonly location: unknown;
  readonly geohash: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly claims: unknown;
  readonly taxonomy: unknown;
  readonly related: unknown;
  readonly primary_image: unknown;
  readonly projection: unknown;
  readonly si_present: boolean;
  readonly si_kind: string | null;
  readonly si_status: string | null;
  readonly si_topics: readonly string[] | null;
  readonly si_facets: unknown;
};

export type ProjectionDivergenceFieldCount = {
  readonly field: string;
  readonly count: number;
  readonly sampleEntityIds: readonly string[];
};

export type ProjectionDivergenceReport = {
  readonly releaseId: string;
  readonly scanned: number;
  /** Rows diverging on at least one field. */
  readonly divergentRows: number;
  /** Sum over fields; a row diverging on three fields counts three times. */
  readonly totalDivergences: number;
  readonly fields: readonly ProjectionDivergenceFieldCount[];
};

export const DEFAULT_DIVERGENCE_SAMPLE_LIMIT = 10;

function asRecord(value: unknown): Rec {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStrings(value: unknown): readonly string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

/** Absence has two spellings across pg and jsonb; both compare as the same missing value. */
function orNull(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** A blank string is absence for the facets that are omitted rather than written empty. */
function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The topics a search row should carry: the display tags when the build produced any, otherwise
 * the topic ids. THE one definition (repo-ttlce).
 *
 * Three writers each spelled this rule differently and two of them got it wrong, which is how
 * 2,141 live rows ended up with real topics in the projection and an empty `search_index.topics`
 * (repo-p1m1y, measured 2026-09-12: 2,137 with ids only, 4 with tags only): `toSearchIndexRow` used `topicTags ?? topicIds`, and `??` falls through only on
 * nullish, so the empty tag list every id-only lane produces won over real ids. The realigner
 * sent to repair them read `topicIds` alone, so it would have written the ids over a record whose
 * build had real display tags. Both now call this.
 *
 * Order is the projection's own — a reader does nothing with topic order, and re-ordering every
 * row would be a write with nothing behind it. `expectedSearchTopics` sorts only so two arrays
 * can be compared as sets.
 */
export function searchTopicsFromProjection(projection: {
  readonly topicTags?: unknown;
  readonly topicIds?: unknown;
}): readonly string[] {
  const tags = asStrings(projection.topicTags);
  return tags.length > 0 ? tags : asStrings(projection.topicIds);
}

export function expectedSearchTopics(projection: Rec): readonly string[] {
  return [...searchTopicsFromProjection(projection)].sort();
}

type DivergenceCheck = {
  readonly field: string;
  /** Skipped when the row has no search-index twin, which is reported as its own field. */
  readonly needsSearchIndex: boolean;
  readonly projectionValue: (projection: Rec) => unknown;
  readonly derivedValue: (row: ProjectionDivergenceDbRow) => unknown;
};

function facetArrayCheck(facetKey: string, projectionKey: string): DivergenceCheck {
  return {
    field: `search_index.facets.${facetKey}`,
    needsSearchIndex: true,
    projectionValue: (projection) => asArray(projection[projectionKey]),
    derivedValue: (row) => asArray(asRecord(row.si_facets)[facetKey]),
  };
}

/**
 * The three fields the release builder DERIVES from a record's claims. Unlike every check above,
 * these do not compare two stores: both sides come from the projection, and the question is
 * whether what is published is still what the record's own claims say.
 *
 * The rule is not restated here. `notabilityBasisIsConverged` is the ratified merge plus the two
 * staleness tests from `lib/notability-basis-resync.ts` — the same code the resync writes with, so
 * a green audit and a no-op resync cannot disagree — and `computeReleaseResearchCoverage` is the
 * production function, not a copy of its grading rules.
 *
 * A row the rule declines to judge (no claims, or nothing the builder can recompute — the
 * `sundown_crescent_springs_kentucky` research gap) is reported as converged rather than as drift:
 * an unanswerable row is a research problem, not a resync problem.
 *
 * `builder.notabilityLabels` is the tightest of the three and needs no recompute at all: the
 * labels are the rubric text for the record's OWN published basis criteria, so a mismatch means
 * one of the two was written and the other was not. Nine rows in the release fail it today,
 * carrying the pre-revision `court_precedent` sentence beside a `court_precedent` basis record —
 * stale prose that `EntityRecordRoom` prints to a reader as the inclusion basis.
 */
export const BUILDER_DIVERGENCE_CHECKS: readonly DivergenceCheck[] = [
  {
    field: 'builder.notabilityBasis',
    needsSearchIndex: false,
    projectionValue: () => true,
    derivedValue: (row) => {
      const projection = asRecord(row.projection);
      return notabilityBasisIsConverged({
        entityId: row.entity_id,
        kind: typeof projection.kind === 'string' ? projection.kind : (row.kind ?? ''),
        displayName:
          typeof projection.displayName === 'string'
            ? projection.displayName
            : (row.display_name ?? ''),
        summary: typeof projection.summary === 'string' ? projection.summary : (row.summary ?? ''),
        claims: toClaimProjections(projection.claims),
        publishedBasis: toBasisRecords(projection.notabilityBasis),
        publishedLabels: asStrings(projection.notabilityLabels),
        hasTaxonomyLabels: false,
        hasSearchIndex: false,
      });
    },
  },
  {
    field: 'builder.notabilityLabels',
    needsSearchIndex: false,
    projectionValue: (projection) =>
      [...notabilityLabelsForBasis(toBasisRecords(projection.notabilityBasis))].sort(),
    derivedValue: (row) => [...asStrings(asRecord(row.projection).notabilityLabels)].sort(),
  },
  {
    field: 'builder.researchCoverage',
    needsSearchIndex: false,
    projectionValue: (projection) =>
      computeReleaseResearchCoverage(
        toClaimProjections(projection.claims),
        typeof projection.summary === 'string' ? projection.summary : '',
      ),
    derivedValue: (row) => orNull(asRecord(row.projection).researchCoverage),
  },
];

/**
 * Every derived copy, paired with the projection value it is supposed to equal.
 *
 * `related` and `claims` are normalized to `[]` on both sides because `toReleaseEntityRow` runs
 * `normalizeReleaseRelated`/`normalizeReleaseClaims` on the column while leaving the projection
 * key absent — a missing key and an empty column say the same thing and must not be reported as
 * drift.
 */
export const PROJECTION_DIVERGENCE_CHECKS: readonly DivergenceCheck[] = [
  {
    field: 'display_name',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(projection.displayName),
    derivedValue: (row) => orNull(row.display_name),
  },
  {
    field: 'kind',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(projection.kind),
    derivedValue: (row) => orNull(row.kind),
  },
  {
    field: 'summary',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(projection.summary),
    derivedValue: (row) => orNull(row.summary),
  },
  {
    field: 'location',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(projection.location),
    derivedValue: (row) => orNull(row.location),
  },
  {
    field: 'lat',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(asRecord(projection.location).lat),
    derivedValue: (row) => orNull(row.lat),
  },
  {
    field: 'lng',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(asRecord(projection.location).lng),
    derivedValue: (row) => orNull(row.lng),
  },
  {
    field: 'geohash',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(asRecord(projection.location).geohash),
    derivedValue: (row) => orNull(row.geohash),
  },
  {
    field: 'related',
    needsSearchIndex: false,
    projectionValue: (projection) => asArray(projection.related),
    derivedValue: (row) => asArray(row.related),
  },
  {
    field: 'claims',
    needsSearchIndex: false,
    projectionValue: (projection) => asArray(projection.claims),
    derivedValue: (row) => asArray(row.claims),
  },
  {
    // The taxonomy column carries three projection lists; other keys on it belong to whichever
    // pass wrote them and are none of this check's business.
    field: 'taxonomy',
    needsSearchIndex: false,
    projectionValue: (projection) => ({
      topicIds: asStrings(projection.topicIds),
      topicTags: asStrings(projection.topicTags),
      notabilityLabels: asStrings(projection.notabilityLabels),
    }),
    derivedValue: (row) => ({
      topicIds: asStrings(asRecord(row.taxonomy).topicIds),
      topicTags: asStrings(asRecord(row.taxonomy).topicTags),
      notabilityLabels: asStrings(asRecord(row.taxonomy).notabilityLabels),
    }),
  },
  {
    field: 'primary_image',
    needsSearchIndex: false,
    projectionValue: (projection) => orNull(projection.primaryImage),
    derivedValue: (row) => orNull(row.primary_image),
  },
  {
    field: 'search_index.kind',
    needsSearchIndex: true,
    projectionValue: (projection) => orNull(projection.kind),
    derivedValue: (row) => orNull(row.si_kind),
  },
  {
    field: 'search_index.status',
    needsSearchIndex: true,
    projectionValue: (projection) => orNull(projection.status),
    derivedValue: (row) => orNull(row.si_status),
  },
  {
    // Compared as a set: both stores are written from one build, but nothing a reader does with
    // topics depends on their order, so ordering alone is not worth reporting as drift.
    field: 'search_index.topics',
    needsSearchIndex: true,
    projectionValue: (projection) => expectedSearchTopics(projection),
    derivedValue: (row) => [...asStrings(row.si_topics)].sort(),
  },
  facetArrayCheck('topicIds', 'topicIds'),
  facetArrayCheck('eraBuckets', 'eraBuckets'),
  facetArrayCheck('keywords', 'keywords'),
  facetArrayCheck('mentionedEntityIds', 'mentionedEntityIds'),
  facetArrayCheck('notabilityLabels', 'notabilityLabels'),
  facetArrayCheck('notabilityBasis', 'notabilityBasis'),
  {
    field: 'search_index.facets.researchCoverage',
    needsSearchIndex: true,
    projectionValue: (projection) => orNull(projection.researchCoverage),
    derivedValue: (row) => orNull(asRecord(row.si_facets).researchCoverage),
  },
  {
    field: 'search_index.facets.sensitivityClass',
    needsSearchIndex: true,
    projectionValue: (projection) => orNull(projection.sensitivityClass),
    derivedValue: (row) => orNull(asRecord(row.si_facets).sensitivityClass),
  },
  {
    // `toSearchIndexRow` omits this facet rather than writing it empty, so a blank projection
    // label and an absent facet agree.
    field: 'search_index.facets.jurisdictionState',
    needsSearchIndex: true,
    projectionValue: (projection) => trimmedOrNull(projection.jurisdictionLabel),
    derivedValue: (row) => trimmedOrNull(asRecord(row.si_facets).jurisdictionState),
  },
];

/** Reported instead of flagging every field on a row whose projection never got written. */
export const MISSING_PROJECTION_FIELD = 'projection.missing';
/** Reported instead of flagging every search-index field on a row that has no twin. */
export const MISSING_SEARCH_INDEX_FIELD = 'search_index.missing';

/**
 * Which question is being asked of a row.
 *
 * `'copies'` — the original one: do this row's derived copies agree with its projection? That is
 * what a post-write check wants to know, because it answers "did my write land everywhere", and a
 * row whose copies all agree has nothing left for the writer to do.
 *
 * `'all'` — that, plus the `builder.*` checks: is what the projection publishes still what the
 * record's own claims say? A row can pass `'copies'` and fail this, because every copy was written
 * from a version of the record that no longer exists. That is a research/resync question, not a
 * failed write, so it belongs to the standing audit (`audit-projection-divergence.ts`, which asks
 * for `'all'`) rather than to the publisher's post-write assert.
 */
export type ProjectionDivergenceScope = 'copies' | 'all';

export function checksForScope(scope: ProjectionDivergenceScope): readonly DivergenceCheck[] {
  return scope === 'all'
    ? [...PROJECTION_DIVERGENCE_CHECKS, ...BUILDER_DIVERGENCE_CHECKS]
    : PROJECTION_DIVERGENCE_CHECKS;
}

/**
 * The fields on which this row's derived copies disagree with its projection. Pure: this is the
 * whole comparison, and the database access below only feeds it.
 */
export function divergentFieldsForRow(
  row: ProjectionDivergenceDbRow,
  scope: ProjectionDivergenceScope = 'copies',
): readonly string[] {
  const projection = asRecord(row.projection);
  // An empty projection is a broken row rather than a field-by-field disagreement; readers get
  // nothing at all from it, and listing eleven fields would bury that.
  if (typeof projection.id !== 'string') return [MISSING_PROJECTION_FIELD];

  const fields: string[] = [];
  if (!row.si_present) fields.push(MISSING_SEARCH_INDEX_FIELD);
  for (const check of checksForScope(scope)) {
    if (check.needsSearchIndex && !row.si_present) continue;
    if (!isDeepStrictEqual(check.projectionValue(projection), check.derivedValue(row))) {
      fields.push(check.field);
    }
  }
  return fields;
}

/** Rolls per-row results into per-field counts with the first `sampleLimit` entity ids. */
export function summarizeProjectionDivergence(
  releaseId: string,
  rows: readonly ProjectionDivergenceDbRow[],
  sampleLimit: number = DEFAULT_DIVERGENCE_SAMPLE_LIMIT,
  scope: ProjectionDivergenceScope = 'copies',
): ProjectionDivergenceReport {
  const counts = new Map<string, { count: number; sampleEntityIds: string[] }>();
  let divergentRows = 0;
  let totalDivergences = 0;

  for (const row of rows) {
    const fields = divergentFieldsForRow(row, scope);
    if (fields.length === 0) continue;
    divergentRows += 1;
    totalDivergences += fields.length;
    for (const field of fields) {
      const bucket = counts.get(field) ?? { count: 0, sampleEntityIds: [] };
      bucket.count += 1;
      if (bucket.sampleEntityIds.length < sampleLimit) bucket.sampleEntityIds.push(row.entity_id);
      counts.set(field, bucket);
    }
  }

  const fields = [...counts]
    .map(([field, bucket]) => ({
      field,
      count: bucket.count,
      sampleEntityIds: bucket.sampleEntityIds,
    }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));

  return { releaseId, scanned: rows.length, divergentRows, totalDivergences, fields };
}

const PROJECTION_DIVERGENCE_SQL = `
  SELECT re.entity_id,
         re.display_name,
         re.kind,
         re.summary,
         re.location,
         re.geohash,
         re.lat,
         re.lng,
         re.claims,
         re.taxonomy,
         re.related,
         re.primary_image,
         re.projection,
         (si.id IS NOT NULL) AS si_present,
         si.kind AS si_kind,
         si.status AS si_status,
         si.topics AS si_topics,
         si.facets AS si_facets
    FROM bb_public.release_entities re
    LEFT JOIN bb_public.search_index si
      ON si.release_id = re.release_id AND si.entity_id = re.entity_id
   WHERE re.release_id = $1
     AND ($2::text[] IS NULL OR re.entity_id = ANY($2::text[]))
   ORDER BY re.entity_id
`;

/**
 * Widened to a structural query surface rather than `Pool | PoolClient` so the catalog write
 * scripts, which hold a bare `pg.Client`, can resolve the release without a cast or a second copy
 * of this one-line query.
 */
export type ActiveReleaseClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: T[] }>;
};

export async function resolveActiveReleaseId(client: ActiveReleaseClient): Promise<string> {
  const result = await client.query<{ release_id: string }>(
    'SELECT release_id FROM bb_public.v_active_release_id',
  );
  const releaseId = result.rows[0]?.release_id;
  if (releaseId === undefined) throw new Error('no active release');
  return releaseId;
}

/** SELECT only. `ids` undefined means the whole release. */
export async function loadProjectionDivergenceRows(
  client: Pool | PoolClient,
  releaseId: string,
  ids?: readonly string[],
): Promise<readonly ProjectionDivergenceDbRow[]> {
  const result = await client.query<ProjectionDivergenceDbRow>(PROJECTION_DIVERGENCE_SQL, [
    releaseId,
    ids === undefined ? null : [...ids],
  ]);
  return result.rows;
}

export type ProjectionDivergenceOptions = {
  /** Defaults to the active release. */
  readonly releaseId?: string;
  /** Defaults to every row in the release. */
  readonly ids?: readonly string[];
  readonly sampleLimit?: number;
  /** Defaults to `'copies'`, so a post-write check keeps answering the question it was written
   * for. The standing audit CLI asks for `'all'`. */
  readonly scope?: ProjectionDivergenceScope;
};

export async function auditProjectionDivergence(
  client: Pool | PoolClient,
  options: ProjectionDivergenceOptions = {},
): Promise<ProjectionDivergenceReport> {
  const releaseId = options.releaseId ?? (await resolveActiveReleaseId(client));
  const rows = await loadProjectionDivergenceRows(client, releaseId, options.ids);
  return summarizeProjectionDivergence(releaseId, rows, options.sampleLimit, options.scope);
}

export function formatProjectionDivergenceReport(
  report: ProjectionDivergenceReport,
): readonly string[] {
  const lines = [
    `Release ${report.releaseId}: ${report.divergentRows} of ${report.scanned} row(s) diverge ` +
      `from their projection across ${report.fields.length} field(s).`,
  ];
  for (const field of report.fields) {
    lines.push(`  ${String(field.count).padStart(6)}  ${field.field}`);
    for (const entityId of field.sampleEntityIds) lines.push(`            e.g. ${entityId}`);
  }
  return lines;
}

/**
 * Post-write check for the publisher and the catalog write scripts: throws when any of `ids`
 * still has a derived copy that disagrees with the projection readers serve.
 *
 * Call it after the write commits, with the ids the write touched. Returns the report when clean
 * so a caller can log what it verified.
 */
export async function assertNoProjectionDivergence(
  client: Pool | PoolClient,
  ids: readonly string[],
  options: Omit<ProjectionDivergenceOptions, 'ids'> = {},
): Promise<ProjectionDivergenceReport> {
  const report = await auditProjectionDivergence(client, { ...options, ids });
  if (report.totalDivergences > 0) {
    throw new Error(
      ['Projection divergence after write:', ...formatProjectionDivergenceReport(report)].join(
        '\n',
      ),
    );
  }
  return report;
}

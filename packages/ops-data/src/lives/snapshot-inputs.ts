/**
 * Read published figures, count notes, coverage overrides and active-release laws for the Lives
 * Across the Decades snapshot. Pure row mappers are shared with tests; the build script
 * executes SQL. Withdrawn laws disappear when the snapshot is rebuilt.
 */
import {
  isLivesLens,
  type LivesApplicabilityInput,
  type LivesCountNoteInput,
  type LivesCoverageInput,
  type LivesObservationInput,
  type LivesSourceRef,
} from '@repo/domain/statistics/lives';

export type ObservationRow = {
  /** Optional so rows read before gaps were derived still map. */
  readonly id?: string;
  readonly metric_id: string;
  readonly jurisdiction_id: string;
  readonly reference_period: string;
  readonly race_ethnicity_slice: string | null;
  readonly estimate: number | string;
  readonly numerator: number | string | null;
  readonly denominator: number | string | null;
  readonly source: string;
  readonly source_url: string;
  readonly metadata: Record<string, unknown> | null;
};

export type CountNoteRow = {
  readonly id: string;
  readonly decade: number;
  readonly applies_to: readonly string[];
  readonly area_ids: readonly string[] | null;
  readonly heading: string;
  readonly body: string;
  readonly citations: unknown;
};

export type CoverageRow = {
  readonly decade: number;
  readonly coverage: unknown;
};

export type ApplicabilityRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly jurisdiction_id: string;
  readonly scope_level: LivesApplicabilityInput['scopeLevel'];
  readonly in_force_from_edtf: string;
  readonly in_force_to_edtf: string | null;
  readonly groups_named: readonly string[] | null;
  readonly applies_to_slices: readonly string[];
  readonly life_domains: readonly string[];
  readonly text_posture: LivesApplicabilityInput['textPosture'];
  readonly disputed: boolean;
  readonly display_name: string;
  readonly kind: string;
  readonly impact_statement: string | null;
  readonly entity_summary: string | null;
};

export const JURISDICTIONS_SQL = `
  SELECT id, name FROM reference.jurisdictions WHERE id = ANY($1::text[])`;

export const OBSERVATIONS_SQL = `
  SELECT id, metric_id, jurisdiction_id, reference_period, race_ethnicity_slice, estimate, numerator,
         denominator, source, source_url, metadata
  FROM reference.statistical_observations
  WHERE jurisdiction_id = ANY($1::text[]) AND status = 'observed' AND metric_id LIKE 'lives-%'`;

export const COUNT_NOTES_SQL = `
  SELECT id, decade, applies_to, area_ids, heading, body, citations
  FROM reference.lives_count_notes
  WHERE status = 'published'
  ORDER BY decade, sort_order, id`;

export const COVERAGE_SQL = `
  SELECT decade, coverage
  FROM reference.region_decade_definitions
  WHERE region_id = $1 AND status = 'published'`;

export const APPLICABILITY_SQL = `
  SELECT a.id, a.entity_id, a.jurisdiction_id, a.scope_level, a.in_force_from_edtf,
         a.in_force_to_edtf, a.groups_named, a.applies_to_slices, a.life_domains,
         a.text_posture, a.disputed,
         e.projection->>'displayName' AS display_name,
         e.projection->>'kind' AS kind,
         e.projection->>'impactStatement' AS impact_statement,
         e.projection->>'summary' AS entity_summary
  FROM reference.law_applicability a
  JOIN published.release_entities e
    ON e.projection->>'id' = a.entity_id
   AND e.release_id = (SELECT release_id FROM published.active_release WHERE id = 'active')
  WHERE a.status = 'published' AND a.jurisdiction_id = ANY($1::text[])`;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapObservationRow(row: ObservationRow): LivesObservationInput {
  const numeratorMoe = numberOrNull(row.metadata?.numeratorMoe);
  const denominatorMoe = numberOrNull(row.metadata?.denominatorMoe);
  return {
    ...(row.id ? { id: row.id } : {}),
    metricId: row.metric_id,
    jurisdictionId: row.jurisdiction_id,
    referencePeriod: row.reference_period,
    raceEthnicitySlice: row.race_ethnicity_slice,
    estimate: Number(row.estimate),
    numerator: numberOrNull(row.numerator),
    denominator: numberOrNull(row.denominator),
    source: row.source,
    sourceUrl: row.source_url,
    metadata:
      numeratorMoe === null && denominatorMoe === null
        ? null
        : {
            ...(numeratorMoe !== null ? { numeratorMoe } : {}),
            ...(denominatorMoe !== null ? { denominatorMoe } : {}),
          },
  };
}

function citationsOf(raw: unknown): LivesSourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { label, url } = entry as Record<string, unknown>;
    return typeof label === 'string' && typeof url === 'string' && /^https?:\/\//.test(url)
      ? [{ label, url }]
      : [];
  });
}

/** A note with no usable citation is dropped: every count note on the page rests on an opened source. */
export function mapCountNoteRow(row: CountNoteRow): LivesCountNoteInput | null {
  const citations = citationsOf(row.citations);
  if (citations.length === 0) return null;
  return {
    id: row.id,
    decade: Number(row.decade),
    appliesTo: row.applies_to.filter(
      (value): value is LivesCountNoteInput['appliesTo'][number] =>
        value === 'all' || isLivesLens(value),
    ),
    areaIds: row.area_ids ?? [],
    heading: row.heading,
    body: row.body,
    citations,
  };
}

/** Coverage overrides stored per area and decade as `[{key, lens, state, reason}]`; malformed entries are skipped. */
export function mapCoverageRow(row: CoverageRow): LivesCoverageInput[] {
  if (!Array.isArray(row.coverage)) return [];
  return row.coverage.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { key, lens, state, reason } = entry as Record<string, unknown>;
    if (typeof key !== 'string' || typeof reason !== 'string') return [];
    if (state !== 'not_measured' && state !== 'suppressed') return [];
    if (lens !== 'all' && !(typeof lens === 'string' && isLivesLens(lens))) return [];
    return [
      {
        decade: Number(row.decade),
        key: key as LivesCoverageInput['key'],
        lens: lens as LivesCoverageInput['lens'],
        state,
        reason,
      },
    ];
  });
}

/** Every published entity renders at `/entity/{id}`; surfaces upgrade this to a law page when one exists. */
export function recordHrefForEntity(entityId: string): string {
  return `/entity/${encodeURIComponent(entityId)}`;
}

/** Year of an EDTF date string (YYYY, YYYY-MM or YYYY-MM-DD). */
export function edtfYear(edtf: string): number {
  const year = Number(edtf.slice(0, 4));
  if (!Number.isInteger(year)) throw new Error(`unreadable EDTF date "${edtf}"`);
  return year;
}

export function mapApplicabilityRow(row: ApplicabilityRow): LivesApplicabilityInput {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityName: row.display_name,
    entityHref: recordHrefForEntity(row.entity_id),
    jurisdictionId: row.jurisdiction_id,
    scopeLevel: row.scope_level,
    inForceFromYear: edtfYear(row.in_force_from_edtf),
    inForceToYear: row.in_force_to_edtf ? edtfYear(row.in_force_to_edtf) : null,
    groupsNamed: row.groups_named ?? [],
    appliesToSlices: row.applies_to_slices as LivesApplicabilityInput['appliesToSlices'],
    lifeDomains: row.life_domains,
    textPosture: row.text_posture,
    disputed: row.disputed,
    summary: row.impact_statement,
    description: row.entity_summary,
  };
}

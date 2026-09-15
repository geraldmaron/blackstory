/**
 * Server-side reader for `/lives/[area]`. Reads the published census figures for the nation and the
 * area's member states, the count notes, any coverage overrides, and the rules in force whose records
 * are live in the active release, then hands them to the shared domain builder so web and mobile
 * assemble the same bundle.
 *
 * Rules join to `bb_public.release_entities` on the active release, so a law withdrawn from the
 * catalog drops off the timeline with it. Query failures propagate: an ISR page keeps its last good
 * render rather than replacing real data with a page of "pending" cells.
 */
import { cache } from 'react';
import {
  LIVES_NATIONAL,
  buildLivesAreaBundle,
  isLivesLens,
  livesAreaBySlug,
  livesStateJurisdictionId,
  type LivesApplicabilityInput,
  type LivesAreaBundle,
  type LivesCountNoteInput,
  type LivesCoverageInput,
  type LivesJurisdictionInput,
  type LivesObservationInput,
  type LivesSourceRef,
} from '@repo/domain/statistics/lives';
import { queryPostgres, resolvePostgresConnectionString } from '../public-data/postgres-client';
import { resolveLawCaseHref } from '../search/law-case-href';

export type ObservationRow = {
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
};

const JURISDICTIONS_SQL = `
  SELECT id, name FROM bb_reference.jurisdictions WHERE id = ANY($1::text[])`;

const OBSERVATIONS_SQL = `
  SELECT metric_id, jurisdiction_id, reference_period, race_ethnicity_slice, estimate, numerator,
         denominator, source, source_url, metadata
  FROM bb_reference.statistical_observations
  WHERE jurisdiction_id = ANY($1::text[]) AND status = 'observed' AND metric_id LIKE 'lives-%'`;

const COUNT_NOTES_SQL = `
  SELECT id, decade, applies_to, area_ids, heading, body, citations
  FROM bb_reference.lives_count_notes
  WHERE status = 'published'
  ORDER BY decade, sort_order, id`;

const COVERAGE_SQL = `
  SELECT decade, coverage
  FROM bb_reference.region_decade_definitions
  WHERE region_id = $1 AND status = 'published'`;

const APPLICABILITY_SQL = `
  SELECT a.id, a.entity_id, a.jurisdiction_id, a.scope_level, a.in_force_from_edtf,
         a.in_force_to_edtf, a.groups_named, a.applies_to_slices, a.life_domains,
         a.text_posture, a.disputed,
         e.projection->>'displayName' AS display_name,
         e.projection->>'kind' AS kind,
         e.projection->>'impactStatement' AS impact_statement
  FROM bb_reference.law_applicability a
  JOIN bb_public.release_entities e
    ON e.projection->>'id' = a.entity_id
   AND e.release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  WHERE a.status = 'published' AND a.jurisdiction_id = ANY($1::text[])`;

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapObservationRow(row: ObservationRow): LivesObservationInput {
  const numeratorMoe = numberOrNull(row.metadata?.numeratorMoe as number | string | undefined);
  const denominatorMoe = numberOrNull(row.metadata?.denominatorMoe as number | string | undefined);
  return {
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

/**
 * The record page for a rule whose law or case has no `/law/{slug}` snapshot. Every published
 * entity renders at `/entity/{id}`, so a rule always links to the record it rests on.
 */
export function recordHrefForEntity(entityId: string): string {
  return `/entity/${encodeURIComponent(entityId)}`;
}

/** Year of an EDTF date string (YYYY, YYYY-MM or YYYY-MM-DD). */
export function edtfYear(edtf: string): number {
  const year = Number(edtf.slice(0, 4));
  if (!Number.isInteger(year)) throw new Error(`unreadable EDTF date "${edtf}"`);
  return year;
}

export function mapApplicabilityRow(
  row: ApplicabilityRow,
  entityHref: string | null,
): LivesApplicabilityInput {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityName: row.display_name,
    entityHref,
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
  };
}

/** The area's bundle, or null when the slug is not the national baseline or a modeled region. */
export const loadLivesAreaBundle = cache(async (slug: string): Promise<LivesAreaBundle | null> => {
  const area = livesAreaBySlug(slug);
  if (!area) return null;

  if (!resolvePostgresConnectionString()) {
    return buildLivesAreaBundle({
      area,
      jurisdictions: [],
      observations: [],
      coverage: [],
      countNotes: [],
      applicability: [],
      frames: [],
    });
  }

  const ids = [
    ...new Set([LIVES_NATIONAL.id, ...area.memberStateFips.map(livesStateJurisdictionId)]),
  ];
  const [jurisdictionRows, observationRows, noteRows, coverageRows, applicabilityRows] =
    await Promise.all([
      queryPostgres<LivesJurisdictionInput>(JURISDICTIONS_SQL, [ids]),
      queryPostgres<ObservationRow>(OBSERVATIONS_SQL, [ids]),
      queryPostgres<CountNoteRow>(COUNT_NOTES_SQL, []),
      queryPostgres<CoverageRow>(COVERAGE_SQL, [area.id]),
      queryPostgres<ApplicabilityRow>(APPLICABILITY_SQL, [ids]),
    ]);
  const applicability = await Promise.all(
    applicabilityRows.map(async (row) =>
      mapApplicabilityRow(
        row,
        (await resolveLawCaseHref({ kind: row.kind, displayName: row.display_name })) ??
          recordHrefForEntity(row.entity_id),
      ),
    ),
  );

  return buildLivesAreaBundle({
    area,
    jurisdictions: jurisdictionRows,
    observations: observationRows.map(mapObservationRow),
    coverage: coverageRows.flatMap(mapCoverageRow),
    countNotes: noteRows.flatMap((row) => mapCountNoteRow(row) ?? []),
    applicability,
    frames: [],
  });
});

/**
 * Server-side reader for `/lives/[region]`. Reads the region's per-decade definitions, its
 * tabulated cells, and the rules in force whose records are live in the active release, then
 * hands them to the shared domain builder so web and mobile assemble the same bundle.
 *
 * Rules join to `bb_public.release_entities` on the active release, so a law withdrawn from the
 * catalog drops off the timeline with it. Query failures propagate: an ISR page keeps its last good
 * render rather than replacing real data with a page of "pending" cells.
 */
import { cache } from 'react';
import {
  buildLivesRegionBundle,
  livesRegionBySlug,
  type LivesApplicabilityInput,
  type LivesJurisdictionInput,
  type LivesObservationInput,
  type LivesRegionBundle,
  type LivesRegionDecadeDefinitionInput,
} from '@repo/domain/statistics/lives';
import { queryPostgres, resolvePostgresConnectionString } from '../public-data/postgres-client';
import { resolveLawCaseHref } from '../search/law-case-href';

export type JurisdictionRow = {
  readonly id: string;
  readonly name: string;
  readonly parent_id: string | null;
};

export type DefinitionRow = {
  readonly region_id: string;
  readonly decade: number;
  readonly reference_period: string;
  readonly boundary_version: string;
  readonly measurement_regime: LivesRegionDecadeDefinitionInput['measurementRegime'];
  readonly comparability_note: string;
  readonly member_county_fips: readonly string[] | null;
  readonly coverage: LivesRegionDecadeDefinitionInput['coverage'] | null;
};

export type ObservationRow = {
  readonly metric_id: string;
  readonly boundary_version: string;
  readonly race_ethnicity_slice: string | null;
  readonly estimate: number | string;
  readonly margin_of_error: number | string | null;
  readonly source: string;
  readonly source_url: string;
  readonly metadata: NonNullable<LivesObservationInput['metadata']> | null;
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

const JURISDICTION_CHAIN_SQL = `
  WITH RECURSIVE chain AS (
    SELECT id, name, parent_id FROM bb_reference.jurisdictions WHERE id = $1
    UNION ALL
    SELECT j.id, j.name, j.parent_id
    FROM bb_reference.jurisdictions j
    JOIN chain c ON j.id = c.parent_id
  )
  SELECT id, name, parent_id FROM chain`;

const DEFINITIONS_SQL = `
  SELECT region_id, decade, reference_period, boundary_version, measurement_regime,
         comparability_note, member_county_fips, coverage
  FROM bb_reference.region_decade_definitions
  WHERE region_id = $1 AND status = 'published'
  ORDER BY decade`;

const OBSERVATIONS_SQL = `
  SELECT metric_id, boundary_version, race_ethnicity_slice, estimate, margin_of_error,
         source, source_url, metadata
  FROM bb_reference.statistical_observations
  WHERE jurisdiction_id = $1 AND status = 'tabulated' AND metric_id LIKE 'ipums-lives-%'`;

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

export function mapJurisdictionRow(row: JurisdictionRow): LivesJurisdictionInput {
  return { id: row.id, name: row.name, parentId: row.parent_id };
}

export function mapDefinitionRow(row: DefinitionRow): LivesRegionDecadeDefinitionInput {
  return {
    regionId: row.region_id,
    decade: Number(row.decade),
    referencePeriod: row.reference_period,
    boundaryVersion: row.boundary_version,
    measurementRegime: row.measurement_regime,
    comparabilityNote: row.comparability_note,
    memberCountyFips: row.member_county_fips ?? [],
    coverage: row.coverage ?? {},
  };
}

export function mapObservationRow(row: ObservationRow): LivesObservationInput {
  return {
    metricId: row.metric_id,
    boundaryVersion: row.boundary_version,
    raceEthnicitySlice: row.race_ethnicity_slice,
    estimate: Number(row.estimate),
    marginOfError: row.margin_of_error === null ? null : Number(row.margin_of_error),
    source: row.source,
    sourceUrl: row.source_url,
    metadata: row.metadata,
  };
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

/** The region's bundle, or null when the slug is not a modeled region. */
export const loadLivesRegionBundle = cache(
  async (slug: string): Promise<LivesRegionBundle | null> => {
    const region = livesRegionBySlug(slug);
    if (!region) return null;
    const regionInput: LivesJurisdictionInput = {
      id: region.id,
      name: region.name,
      parentId: region.parentId,
    };

    if (!resolvePostgresConnectionString()) {
      return buildLivesRegionBundle({
        region: regionInput,
        jurisdictions: [regionInput],
        definitions: [],
        observations: [],
        applicability: [],
        frames: [],
      });
    }

    const [chainRows, definitionRows, observationRows] = await Promise.all([
      queryPostgres<JurisdictionRow>(JURISDICTION_CHAIN_SQL, [region.id]),
      queryPostgres<DefinitionRow>(DEFINITIONS_SQL, [region.id]),
      queryPostgres<ObservationRow>(OBSERVATIONS_SQL, [region.id]),
    ]);
    const jurisdictions = chainRows.map(mapJurisdictionRow);
    const definitions = definitionRows.map(mapDefinitionRow);
    const countyIds = new Set(
      [...region.coreCountyFips, ...definitions.flatMap((d) => d.memberCountyFips)].map(
        (fips) => `county:${fips}`,
      ),
    );
    const applicabilityRows = await queryPostgres<ApplicabilityRow>(APPLICABILITY_SQL, [
      [...jurisdictions.map((j) => j.id), ...countyIds],
    ]);
    const applicability = await Promise.all(
      applicabilityRows.map(async (row) =>
        mapApplicabilityRow(
          row,
          (await resolveLawCaseHref({ kind: row.kind, displayName: row.display_name })) ?? null,
        ),
      ),
    );

    return buildLivesRegionBundle({
      region: regionInput,
      jurisdictions: jurisdictions.length > 0 ? jurisdictions : [regionInput],
      definitions,
      observations: observationRows.map(mapObservationRow),
      applicability,
      frames: [],
    });
  },
);

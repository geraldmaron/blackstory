/**
 * Maps DSL Renewing Inequality Chicago urban renewal attribute CSV rows into Phase 1
 * observation and cite-only artifact drafts. Pure functions — network fetch lives in
 * ./fetch-chicago-projects.ts. Polygons remain rights-gated (NC-SA); public surfaces cite only.
 */
import { assertPublishedStatisticProvenance } from '../../public-numeric-policy.js';
import { sha256Json } from '../../publication/index.js';
import type { Phase1IndicatorDefinition } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_INDICATOR_CATALOG } from '../../statistics/phase1-indicator-catalog.js';
import { PHASE1_DSL_RENEWING_INEQUALITY_INDICATOR_DEFINITIONS } from '../../statistics/phase1-dsl-renewing-inequality-indicator-catalog.js';
import {
  DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE,
  DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MAX,
  DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MIN,
  DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS,
  DSL_RENEWING_INEQUALITY_DATASET_VINTAGE,
  DSL_RENEWING_INEQUALITY_GITHUB_REPO_URL,
  DSL_RENEWING_INEQUALITY_HOMEPAGE_URL,
  DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL,
  PHASE1_UR_DWELLING_UNITS_SUBSTANDARD_PROJECT_METRIC_ID,
  PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID,
  PHASE1_UR_TOTAL_FAMILIES_PROJECT_METRIC_ID,
} from './constants.js';

export type DslRenewingInequalityAttributeRow = {
  readonly categoryId: string;
  readonly projectId: string;
  readonly value: number;
  readonly year: number;
  readonly quarter: string;
  readonly unitOfMeasurement: string;
  readonly categoryLabel: string;
  readonly projectName: string;
  readonly city: string;
  readonly state: string;
};

export type DslRenewingInequalityChicagoProject = {
  readonly projectId: string;
  readonly projectName: string;
  readonly city: string;
  readonly state: string;
  readonly referenceYear: number;
  readonly nonwhiteFamilies?: number;
  readonly totalFamilies?: number;
  readonly dwellingUnitsSubstandard?: number;
  readonly dwellingUnitsStandard?: number;
  readonly attributeRowCount: number;
};

export type Phase1DslRenewingInequalityObservationDraft = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
  readonly attributionNote: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly surfacePolicy: 'staff_research';
};

export type Phase1DslRenewingInequalityArtifactDraft = {
  readonly artifactId: string;
  readonly artifactClass: 'primary_government_document' | 'cartographic_project_map';
  readonly title: string;
  readonly citation: string;
  readonly dated: string;
  readonly summary: string;
  readonly uncertaintyLabel: string;
  readonly sourceUrl: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly surfacePolicy: 'cite_only_public';
};

const PROJECT_BOUNDARY_VERSION = 'ur-project-vintage-1955-1966';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function projectJurisdictionId(projectId: string): string {
  return `ur-project:${projectId}`;
}

function observationId(metricId: string, jurisdictionId: string, referencePeriod: string): string {
  return `obs:${metricId}:${jurisdictionId}:${referencePeriod}`;
}

function contentHash(parts: {
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly boundaryVersion: string;
}): string {
  return sha256Json(parts).digest;
}

function metricById(metricId: string): Phase1IndicatorDefinition {
  const metric =
    PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId) ??
    PHASE1_DSL_RENEWING_INEQUALITY_INDICATOR_DEFINITIONS.find((row) => row.metricId === metricId);
  if (!metric) {
    throw new Error(`Unknown Phase 1 metric: ${metricId}`);
  }
  return metric;
}

function normalizeCity(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeState(raw: string): string {
  return raw.trim().toLowerCase();
}

function isChicagoPilotRow(row: Pick<DslRenewingInequalityAttributeRow, 'city' | 'state'>): boolean {
  return normalizeCity(row.city) === 'chicago' && normalizeState(row.state) === 'il';
}

function isWithinAttributeYears(year: number): boolean {
  return year >= DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MIN && year <= DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MAX;
}

/** Parses Renewing Inequality non_spatial_data.csv attribute rows. */
export function parseDslRenewingInequalityAttributeCsv(csvText: string): {
  readonly rows: readonly DslRenewingInequalityAttributeRow[];
  readonly rejected: readonly string[];
} {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], rejected: ['csv has no data rows'] };
  }

  const header = splitCsvLine(lines[0]!);
  const columnIndex = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx < 0) {
      throw new Error(`Renewing Inequality CSV missing expected column: ${name}`);
    }
    return idx;
  };

  const categoryIdIdx = columnIndex('category_id');
  const projectIdIdx = columnIndex('project_id');
  const valueIdx = columnIndex('value');
  const yearIdx = columnIndex('year');
  const quarterIdx = columnIndex('quarter');
  const unitIdx = columnIndex('unit_of_measurement');
  const catIdx = columnIndex('cat');
  const projectIdx = columnIndex('project');
  const cityIdx = columnIndex('city');
  const stateIdx = columnIndex('state');

  const rows: DslRenewingInequalityAttributeRow[] = [];
  const rejected: string[] = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo]!;
    const cols = splitCsvLine(line);
    const year = parseNumber(cols[yearIdx]);
    const value = parseNumber(cols[valueIdx]);
    const projectId = cols[projectIdIdx]?.trim() ?? '';
    if (year === undefined || value === undefined || !/^\d+$/.test(projectId)) {
      rejected.push(`line ${lineNo + 1}: malformed year/value/project_id`);
      continue;
    }
    rows.push({
      categoryId: cols[categoryIdIdx]?.trim() ?? '',
      projectId,
      value,
      year,
      quarter: cols[quarterIdx]?.trim() ?? '',
      unitOfMeasurement: cols[unitIdx]?.trim() ?? '',
      categoryLabel: cols[catIdx]?.trim() ?? '',
      projectName: cols[projectIdx]?.trim() ?? '',
      city: cols[cityIdx]?.trim() ?? '',
      state: cols[stateIdx]?.trim() ?? '',
    });
  }

  return { rows, rejected };
}

/** Filters parsed rows to Chicago IL attributes within the pilot year window. */
export function filterChicagoUrbanRenewalRows(
  rows: readonly DslRenewingInequalityAttributeRow[],
): readonly DslRenewingInequalityAttributeRow[] {
  return rows.filter((row) => isChicagoPilotRow(row) && isWithinAttributeYears(row.year));
}

/** Collapses attribute rows into one project record per project_id (latest year per category). */
export function buildChicagoUrbanRenewalProjects(
  rows: readonly DslRenewingInequalityAttributeRow[],
): readonly DslRenewingInequalityChicagoProject[] {
  const byProject = new Map<
    string,
    {
      projectName: string;
      city: string;
      state: string;
      rows: DslRenewingInequalityAttributeRow[];
    }
  >();

  for (const row of rows) {
    const existing = byProject.get(row.projectId);
    if (existing) {
      existing.rows.push(row);
      if (row.projectName) existing.projectName = row.projectName;
    } else {
      byProject.set(row.projectId, {
        projectName: row.projectName,
        city: row.city,
        state: row.state,
        rows: [row],
      });
    }
  }

  const projects: DslRenewingInequalityChicagoProject[] = [];
  for (const [projectId, bucket] of byProject.entries()) {
    const latestByCategory = new Map<string, DslRenewingInequalityAttributeRow>();
    for (const row of bucket.rows) {
      const prior = latestByCategory.get(row.categoryId);
      if (!prior || row.year > prior.year) {
        latestByCategory.set(row.categoryId, row);
      }
    }

    const referenceYear = Math.max(...bucket.rows.map((row) => row.year));
    const nonwhiteFamilies = latestByCategory.get(
      DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS.nonwhiteFamilies,
    );
    const totalFamilies = latestByCategory.get(
      DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS.totalFamilies,
    );
    const dwellingSubstandard = latestByCategory.get(
      DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS.dwellingUnitsSubstandard,
    );
    const dwellingStandard = latestByCategory.get(
      DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS.dwellingUnitsStandard,
    );

    projects.push({
      projectId,
      projectName: bucket.projectName,
      city: bucket.city,
      state: bucket.state,
      referenceYear,
      attributeRowCount: bucket.rows.length,
      ...(nonwhiteFamilies ? { nonwhiteFamilies: nonwhiteFamilies.value } : {}),
      ...(totalFamilies ? { totalFamilies: totalFamilies.value } : {}),
      ...(dwellingSubstandard ? { dwellingUnitsSubstandard: dwellingSubstandard.value } : {}),
      ...(dwellingStandard ? { dwellingUnitsStandard: dwellingStandard.value } : {}),
    });
  }

  return projects.sort((a, b) => Number(a.projectId) - Number(b.projectId));
}

function buildObservationDraft(input: {
  readonly project: DslRenewingInequalityChicagoProject;
  readonly metricId: string;
  readonly estimate: number;
  readonly retrievedAt: string;
}): Phase1DslRenewingInequalityObservationDraft {
  const metric = metricById(input.metricId);
  const jurisdictionId = projectJurisdictionId(input.project.projectId);
  const referencePeriod = String(input.project.referenceYear);
  const draft: Phase1DslRenewingInequalityObservationDraft = {
    id: observationId(metric.metricId, jurisdictionId, referencePeriod),
    metricId: metric.metricId,
    jurisdictionId,
    boundaryVersion: PROJECT_BOUNDARY_VERSION,
    referencePeriod,
    datasetVintage: DSL_RENEWING_INEQUALITY_DATASET_VINTAGE,
    estimate: input.estimate,
    source: metric.externalDataSourceId,
    sourceUrl: DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL,
    retrievedAt: input.retrievedAt,
    contentHash: contentHash({
      metricId: metric.metricId,
      jurisdictionId,
      referencePeriod,
      estimate: input.estimate,
      boundaryVersion: PROJECT_BOUNDARY_VERSION,
    }),
    attributionNote: DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE,
    projectId: input.project.projectId,
    projectName: input.project.projectName,
    surfacePolicy: 'staff_research',
  };
  assertPublishedStatisticProvenance(draft);
  return draft;
}

/** Maps Chicago project records to staff-research observation drafts (displacement counts). */
export function mapChicagoProjectsToObservationDrafts(
  projects: readonly DslRenewingInequalityChicagoProject[],
  retrievedAt: string,
): readonly Phase1DslRenewingInequalityObservationDraft[] {
  const drafts: Phase1DslRenewingInequalityObservationDraft[] = [];
  for (const project of projects) {
    if (project.nonwhiteFamilies !== undefined) {
      drafts.push(
        buildObservationDraft({
          project,
          metricId: PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID,
          estimate: project.nonwhiteFamilies,
          retrievedAt,
        }),
      );
    }
    if (project.totalFamilies !== undefined) {
      drafts.push(
        buildObservationDraft({
          project,
          metricId: PHASE1_UR_TOTAL_FAMILIES_PROJECT_METRIC_ID,
          estimate: project.totalFamilies,
          retrievedAt,
        }),
      );
    }
    if (project.dwellingUnitsSubstandard !== undefined) {
      drafts.push(
        buildObservationDraft({
          project,
          metricId: PHASE1_UR_DWELLING_UNITS_SUBSTANDARD_PROJECT_METRIC_ID,
          estimate: project.dwellingUnitsSubstandard,
          retrievedAt,
        }),
      );
    }
  }
  return drafts;
}

function buildArtifactDraft(
  project: DslRenewingInequalityChicagoProject,
): Phase1DslRenewingInequalityArtifactDraft {
  const title = `Chicago urban renewal project — ${project.projectName}`;
  const dated = `${DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MIN}–${DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MAX}`;
  const summary =
    `Federal urban renewal characteristics for project ${project.projectId} (${project.projectName}). ` +
    'Attribute counts from non_spatial_data.csv; polygon geometry incomplete for Chicago and remains gated.';
  return {
    artifactId: `art_dsl_renewal_chicago_${project.projectId}`,
    artifactClass: 'primary_government_document',
    title,
    citation:
      'Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, ' +
      `University of Richmond, ${DSL_RENEWING_INEQUALITY_HOMEPAGE_URL} (CC BY-NC-SA 4.0 on vector derivatives). ` +
      `Federal characteristics via ${DSL_RENEWING_INEQUALITY_GITHUB_REPO_URL}.`,
    dated,
    summary,
    uncertaintyLabel:
      'Polygons are incomplete by city and NC-SA gated — public commercial surfaces cite only; ' +
      'no live GeoJSON layer until rights review clears target surface.',
    sourceUrl: DSL_RENEWING_INEQUALITY_HOMEPAGE_URL,
    projectId: project.projectId,
    projectName: project.projectName,
    surfacePolicy: 'cite_only_public',
  };
}

/** Maps Chicago projects to cite-only artifact drafts (no geometry payload). */
export function mapChicagoProjectsToArtifactDrafts(
  projects: readonly DslRenewingInequalityChicagoProject[],
): readonly Phase1DslRenewingInequalityArtifactDraft[] {
  const perProject = projects.map((project) => buildArtifactDraft(project));
  const overview: Phase1DslRenewingInequalityArtifactDraft = {
    artifactId: 'art_dsl_renewal_chicago_overview',
    artifactClass: 'cartographic_project_map',
    title: 'Renewing Inequality — Chicago urban renewal projects (cite-only)',
    citation:
      'Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, ' +
      `University of Richmond, ${DSL_RENEWING_INEQUALITY_HOMEPAGE_URL} (CC BY-NC-SA 4.0).`,
    dated: `${DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MIN}–${DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MAX}`,
    summary: `${projects.length} Chicago projects with federal characteristics attributes in the pilot window; polygon coverage is partial (17 GeoJSON features vs ${projects.length} attribute projects).`,
    uncertaintyLabel:
      'Do not ship NC GeoJSON polygons on public commercial surfaces without rights review.',
    sourceUrl: DSL_RENEWING_INEQUALITY_HOMEPAGE_URL,
    projectId: 'chicago-overview',
    projectName: 'Chicago urban renewal pilot',
    surfacePolicy: 'cite_only_public',
  };
  return [overview, ...perProject];
}

/** Indicator definitions available from this adapter (pending catalog merge). */
export function listPhase1DslRenewingInequalityIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_DSL_RENEWING_INEQUALITY_INDICATOR_DEFINITIONS;
}

export function countChicagoUrbanRenewalProjects(
  projects: readonly DslRenewingInequalityChicagoProject[],
): number {
  return projects.length;
}

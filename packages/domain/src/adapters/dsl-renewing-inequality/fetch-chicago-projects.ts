/**
 * Live fetch for DSL Renewing Inequality Chicago urban renewal project attributes.
 * Supports fixture csvText for tests; default URL is the GitHub non_spatial_data.csv export.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import { DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL } from './constants.js';
import {
  buildChicagoUrbanRenewalProjects,
  countChicagoUrbanRenewalProjects,
  filterChicagoUrbanRenewalRows,
  mapChicagoProjectsToArtifactDrafts,
  mapChicagoProjectsToObservationDrafts,
  parseDslRenewingInequalityAttributeCsv,
  type DslRenewingInequalityChicagoProject,
  type Phase1DslRenewingInequalityArtifactDraft,
  type Phase1DslRenewingInequalityObservationDraft,
} from './chicago-project-mapper.js';

export type DslRenewingInequalityChicagoFetchResult = {
  readonly projects: readonly DslRenewingInequalityChicagoProject[];
  readonly observations: readonly Phase1DslRenewingInequalityObservationDraft[];
  readonly artifacts: readonly Phase1DslRenewingInequalityArtifactDraft[];
  readonly rejected: readonly string[];
  readonly rowsParsed: number;
  readonly chicagoProjectCount: number;
  readonly sourceUrl: string;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly csvText?: string;
  readonly retrievedAt?: string;
};

export async function fetchChicagoUrbanRenewalProjects(
  options: FetchOptions = {},
): Promise<DslRenewingInequalityChicagoFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const csvText =
    options.csvText ??
    (await (async () => {
      const response = await fetchImpl(DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL);
      if (!response.ok) {
        throw new Error(
          `Renewing Inequality CSV fetch failed (${response.status}) from ${DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL}`,
        );
      }
      return response.text();
    })());

  const parsed = parseDslRenewingInequalityAttributeCsv(csvText);
  const chicagoRows = filterChicagoUrbanRenewalRows(parsed.rows);
  const projects = buildChicagoUrbanRenewalProjects(chicagoRows);
  const observations = mapChicagoProjectsToObservationDrafts(projects, retrievedAt);
  const artifacts = mapChicagoProjectsToArtifactDrafts(projects);

  return {
    projects,
    observations,
    artifacts,
    rejected: parsed.rejected,
    rowsParsed: parsed.rows.length + parsed.rejected.length,
    chicagoProjectCount: countChicagoUrbanRenewalProjects(projects),
    sourceUrl: DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL,
  };
}

/**
 * DSL Renewing Inequality adapter surface for Chicago urban renewal pilot (1955–1966).
 */
export {
  DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE,
  DSL_RENEWING_INEQUALITY_CHICAGO_SCOPE,
  DSL_RENEWING_INEQUALITY_DATASET_VINTAGE,
  DSL_RENEWING_INEQUALITY_GITHUB_REPO_URL,
  DSL_RENEWING_INEQUALITY_HOMEPAGE_URL,
  DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL,
  DSL_RENEWING_INEQUALITY_PROJECTS_GEOJSON_URL,
  PHASE1_UR_DWELLING_UNITS_SUBSTANDARD_PROJECT_METRIC_ID,
  PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID,
  PHASE1_UR_TOTAL_FAMILIES_PROJECT_METRIC_ID,
} from './constants.js';
export {
  buildChicagoUrbanRenewalProjects,
  countChicagoUrbanRenewalProjects,
  filterChicagoUrbanRenewalRows,
  listPhase1DslRenewingInequalityIndicators,
  mapChicagoProjectsToArtifactDrafts,
  mapChicagoProjectsToObservationDrafts,
  parseDslRenewingInequalityAttributeCsv,
  type DslRenewingInequalityAttributeRow,
  type DslRenewingInequalityChicagoProject,
  type Phase1DslRenewingInequalityArtifactDraft,
  type Phase1DslRenewingInequalityObservationDraft,
} from './chicago-project-mapper.js';
export {
  fetchChicagoUrbanRenewalProjects,
  type DslRenewingInequalityChicagoFetchResult,
} from './fetch-chicago-projects.js';

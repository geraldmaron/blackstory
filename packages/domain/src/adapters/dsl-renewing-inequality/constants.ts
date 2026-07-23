/**
 * DSL Renewing Inequality Phase 1 constants — Chicago urban renewal pilot (1955–1966).
 * Source family matches Mapping Inequality HOLC: CC BY-NC-SA vector derivatives; cite/gated only.
 */

/** Registry homepage — cite on every artifact and observation. */
export const DSL_RENEWING_INEQUALITY_HOMEPAGE_URL =
  'https://dsl.richmond.edu/panorama/renewal/';

/** GitHub data repository (non_spatial attributes + gated GeoJSON). */
export const DSL_RENEWING_INEQUALITY_GITHUB_REPO_URL =
  'https://github.com/americanpanorama/Renewing_Inequality_Data';

export const DSL_RENEWING_INEQUALITY_NON_SPATIAL_CSV_URL =
  'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/non_spatial_data.csv';

/** Polygon layer — staff/research only until rights review; never ship on commercial anon surfaces. */
export const DSL_RENEWING_INEQUALITY_PROJECTS_GEOJSON_URL =
  'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/ur_projects.geojson';

export const DSL_RENEWING_INEQUALITY_DATASET_VINTAGE =
  'Renewing Inequality federal urban renewal characteristics 1955–1966';

export const DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MIN = 1955;
export const DSL_RENEWING_INEQUALITY_ATTRIBUTE_YEAR_MAX = 1966;

/** Chicago pilot scope key (Cook County metro). */
export const DSL_RENEWING_INEQUALITY_CHICAGO_SCOPE = 'metro:chicago-il' as const;

export const PHASE1_UR_NONWHITE_FAMILIES_PROJECT_METRIC_ID = 'ur-nonwhite-families-project';

export const PHASE1_UR_TOTAL_FAMILIES_PROJECT_METRIC_ID = 'ur-total-families-project';

export const PHASE1_UR_DWELLING_UNITS_SUBSTANDARD_PROJECT_METRIC_ID =
  'ur-dwelling-units-substandard-project';

/** Required attribution for stored drafts (NC-SA posture). */
export const DSL_RENEWING_INEQUALITY_ATTRIBUTION_NOTE =
  'Renewing Inequality: Urban Renewal and the American City, Digital Scholarship Lab, ' +
  'University of Richmond, https://dsl.richmond.edu/panorama/renewal/ (CC BY-NC-SA 4.0 on ' +
  'vector derivatives). Federal characteristics reports are U.S. government works; polygon ' +
  'product remains cite-only on public commercial surfaces pending rights review.';

/**
 * Chicago federal characteristics category ids (codebook 67–88).
 * Longitudinal categories 3/29/31 are absent from Chicago rows — use 72/80/69/70 instead.
 */
export const DSL_RENEWING_INEQUALITY_CHICAGO_CATEGORY_IDS = {
  dwellingUnitsSubstandard: '69',
  dwellingUnitsStandard: '70',
  nonwhiteFamilies: '72',
  totalFamilies: '80',
} as const;

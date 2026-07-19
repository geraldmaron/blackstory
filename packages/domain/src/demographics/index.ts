/**
 * Demographics comparability and census category documentation — shared vocabulary for
 * firebase loaders, Data page copy, and future NHGIS historical ingestion.
 */
export {
  BOUNDARY_CHANGE_CAUTION,
  COMPARABILITY_NOTE_2000_2020,
  DECADE_RACE_CATEGORY_BANDS,
  MODERN_BLACK_ALONE_BANDS,
  getDecadeRaceCategoryBand,
  isModernBlackAloneDecade,
  type DecadeComparabilityBand,
  type DecadeRaceCategoryBand,
} from './comparability.js';

export {
  POPULATION_DECADES,
  POPULATION_DECADE_METAS,
  HISTORICAL_NATIONAL_DECADES,
  MODERN_COUNTY_DECADES,
  FREE_ENSLAVED_SPLIT_DECADES,
  isPopulationDecade,
  getPopulationDecadeMeta,
  changeCrossesDefinitionBoundary,
  type PopulationDecade,
  type PopulationDecadeMeta,
  type NationalPopulationSource,
} from './population-decades.js';

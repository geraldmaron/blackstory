/**
 * Local module surface for the BB-091 Census TIGER/Gazetteer source-registry contract.
 *
 * NOT re-exported from ../index.ts (the adapters package barrel) or ../../index.ts (the
 * @black-book/domain package barrel) — per this session's barrel-ownership rule, only the
 * parent session merges new symbols into those files. Until that merge lands, consumers
 * outside this package must import this module by its own relative path within the domain
 * package's source (or wait for the barrel wiring); see the final report's "still needs
 * wiring" note.
 */
export {
  CENSUS_GEO_ADAPTER_ID,
  CENSUS_GEO_ORGANIZATION_ID,
  CENSUS_GEO_PARSER_VERSION,
  CENSUS_GEO_RIGHTS,
  CENSUS_GEO_SOURCE_ID,
  createCensusGeoAdapterContract,
  createCensusGeoEvidenceSource,
} from './contract.js';

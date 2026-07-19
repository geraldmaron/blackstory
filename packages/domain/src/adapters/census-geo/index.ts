/**
 * Local module surface for the Census adapters: the TIGER/Gazetteer bulk source-registry
 * contract (`./contract.ts`) AND the live Census Geocoder API client
 * (`./url-builder.ts`, `./response-parser.ts`, `./normalizer.ts`, `./fetch-geocode.ts`).
 *
 * IS re-exported through the package barrels: `../index.ts` (the adapters package barrel)
 * already does `export * from './census-geo/index.js';` (added for), and
 * `../../index.ts` (the `@repo/domain` package barrel) already does
 * `export * from './adapters/index.js';` so every symbol exported from THIS file is already
 * reachable as `@repo/domain` today with no further barrel edit required. This is
 * different from the brand-new `../../geocode/` module (see its index.ts doc comment), which
 * has no existing wildcard chain and does need a parent-session merge.
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

export {
  CENSUS_GEOCODER_BENCHMARK,
  CENSUS_GEOCODER_VINTAGE,
  type CensusGeocodeBatch,
  type CensusGeocodeMatch,
  type CensusGeocodeRejection,
  type RawCensusAddressGeocodeResponse,
  type RawCensusAddressMatch,
  type RawCensusCoordinates,
  type RawCensusCoordinatesGeocodeResponse,
  type RawCensusGeographiesBlock,
  type RawCensusGeographyEntry,
} from './types.js';

export {
  CENSUS_GEOCODER_BASE_URL,
  buildCensusCoordinatesUrl,
  buildCensusOneLineAddressUrl,
  type BuildCensusCoordinatesUrlInput,
  type BuildCensusOneLineAddressUrlInput,
} from './url-builder.js';

export {
  parseCensusAddressGeocodeResponse,
  parseCensusCoordinatesGeocodeResponse,
} from './response-parser.js';

export {
  extractCensusGeography,
  normalizeCensusAddressMatch,
  normalizeCensusCoordinatesGeographies,
  type ExtractedCensusGeography,
} from './normalizer.js';

export {
  fetchCensusAddressGeocode,
  fetchCensusCoordinatesGeocode,
  type FetchCensusAddressGeocodeInput,
  type FetchCensusCoordinatesGeocodeInput,
} from './fetch-geocode.js';

/**
 * IPUMS NHGIS county race time-series types (scaffold). Live extract against the IPUMS API
 * requires a registered user's NHGIS_API_KEY — a human gate before any ingestion adapter moves
 * `external-data:nhgis-county-race` out of registryState disabled. No live fetch is implemented
 * here; see `./index.ts` for the fail-closed entry point.
 */

/** Registry id shared with `external-data-sources.ts` (`nhgis-county-race`). */
export const NHGIS_COUNTY_RACE_SOURCE_ID = 'nhgis-county-race';

/** Stable adapter namespace for future SourceAdapterContract registration. */
export const NHGIS_ADAPTER_ID = `external-data:${NHGIS_COUNTY_RACE_SOURCE_ID}` as const;

/** Request shape for a future county race time-series extract (not yet wired). */
export type NhgisCountyRaceExtractRequest = {
  readonly stateFips?: string;
  readonly countyFips?: string;
  readonly decades?: readonly string[];
};

/** Placeholder result envelope — populated once live extract ships. */
export type NhgisCountyRaceExtractResult = {
  readonly request: NhgisCountyRaceExtractRequest;
  readonly rows: readonly [];
  readonly rejected: readonly string[];
};

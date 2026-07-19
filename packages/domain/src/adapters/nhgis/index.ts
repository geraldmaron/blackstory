/**
 * IPUMS NHGIS adapter scaffold. Historical decennial county race tables (1790–2020) will be
 * fetched through the IPUMS API once an operator registers NHGIS_API_KEY — until then every
 * entry point fails closed with "NHGIS_API_KEY required". Full extract parsing is intentionally
 * unimplemented; comparability documentation lives in `../../demographics/comparability.ts`.
 */
import type { NhgisCountyRaceExtractRequest, NhgisCountyRaceExtractResult } from './types.js';

export {
  NHGIS_ADAPTER_ID,
  NHGIS_COUNTY_RACE_SOURCE_ID,
  type NhgisCountyRaceExtractRequest,
  type NhgisCountyRaceExtractResult,
} from './types.js';

/** Fail-closed guard — mirrors census-demographics' caller-supplied key pattern. */
export function assertNhgisApiKeyConfigured(apiKey: string | undefined): asserts apiKey is string {
  if (!apiKey?.trim()) {
    throw new Error('NHGIS_API_KEY required');
  }
}

/**
 * Stub entry point for county race time-series extract. Throws until live IPUMS integration
 * lands and a human has registered NHGIS_API_KEY.
 */
export async function fetchNhgisCountyRaceTimeSeries(
  _request: NhgisCountyRaceExtractRequest,
  options: { readonly apiKey?: string } = {},
): Promise<NhgisCountyRaceExtractResult> {
  assertNhgisApiKeyConfigured(options.apiKey);
  throw new Error('NHGIS county race extract is not implemented — scaffold only');
}

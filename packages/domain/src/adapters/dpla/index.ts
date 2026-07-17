/**
 * DPLA v2 community discovery adapter public surface.
 */
export {
  DPLA_V2_ADAPTER_ID,
  DPLA_V2_PARSER_VERSION,
  DPLA_V2_STABLE_ID_SCHEME,
  DPLA_V2_PAYLOAD_SCHEMA_VERSION,
  DPLA_V2_DEFAULT_CLASSIFICATION,
  type DplaNormalizedDoc,
  type DplaRejectedDoc,
  type DplaParsedBatch,
  type DplaCandidatePayload,
  type DplaCandidateRecord,
} from './types.js';

export { parseDplaSearchResponse, buildDplaSearchUrl } from './client.js';

export {
  buildDplaCanonicalUrl,
  normalizeDplaDoc,
  normalizeDplaBatch,
  assertDplaCandidate,
  type NormalizeDplaDocInput,
} from './normalizer.js';

export { createDplaV2AdapterContract } from './contract.js';

export { fetchDplaSearch, type FetchDplaSearchInput } from './fetch-search.js';

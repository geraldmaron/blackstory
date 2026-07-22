/**
 * Chronicling America historic newspapers adapter public surface.
 */
export {
  CHRONICLING_AMERICA_ADAPTER_ID,
  CHRONICLING_AMERICA_PARSER_VERSION,
  CHRONICLING_AMERICA_STABLE_ID_SCHEME,
  CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION,
  CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION,
  CHRONICLING_AMERICA_SOURCE_ID,
  CHRONICLING_AMERICA_ORG_ID,
  CHRONICLING_AMERICA_CAMPAIGN_BUDGET,
  type ChroniclingAmericaNormalizedDoc,
  type ChroniclingAmericaRejectedDoc,
  type ChroniclingAmericaParsedBatch,
  type ChroniclingAmericaCandidatePayload,
  type ChroniclingAmericaCandidateRecord,
  type ChroniclingAmericaParseResult,
  type ChroniclingAmericaAdapterDefinition,
  type ChroniclingAmericaRetentionRules,
  type ChroniclingAmericaExportFilterPolicy,
} from './types.js';

export {
  buildChroniclingAmericaAdapterDefinition,
  CHRONICLING_AMERICA_PUBLIC_DOMAIN_RIGHTS,
  DEFAULT_CHRONICLING_AMERICA_EXPORT_FILTER,
  DEFAULT_CHRONICLING_AMERICA_RETENTION,
} from './contract-builder.js';

export { chroniclingAmericaAdapterDefinition } from './definition.js';

export { createChroniclingAmericaAdapterContract } from './contract.js';

export {
  CHRONICLING_AMERICA_KILL_SWITCH_PREFIX,
  chroniclingAmericaKillSwitchId,
  parseChroniclingAmericaKillSwitchId,
} from './kill-switch.js';

export {
  buildChroniclingAmericaCanonicalUrl,
  buildChroniclingAmericaItemUrl,
  buildChroniclingAmericaSearchUrl,
  buildChroniclingAmericaStableIdentifier,
  extractLccnFromLocUrl,
  parseChroniclingAmericaItemResponse,
  parseChroniclingAmericaSearchResponse,
} from './client.js';

export {
  assertChroniclingAmericaCandidate,
  normalizeChroniclingAmericaBatch,
  normalizeChroniclingAmericaDoc,
  type NormalizeChroniclingAmericaDocInput,
} from './normalizer.js';

export {
  parseChroniclingAmericaFixtureBatch,
  parseChroniclingAmericaSearchFixture,
} from './parser.js';

export {
  registerChroniclingAmericaSource,
  type RegisterChroniclingAmericaSourceInput,
} from './registration.js';

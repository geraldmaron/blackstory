/**
 * NRHP Multiple Property Listing (MPL) African American curated-net adapter public surface.
 * Fixtures-first, registered disabled — distinct from the NRHP property listing corpus and the
 * federal NPS adapter. Parent registers via `registerNrhpMplAdapter`; do not call
 * `approveSourcePolicy` until explicit policy approval.
 */
export {
  NRHP_MPL_ADAPTER_ID,
  NRHP_MPL_PARSER_VERSION,
  NRHP_MPL_STABLE_ID_SCHEME,
  NRHP_MPL_PAYLOAD_SCHEMA_VERSION,
  NRHP_MPL_DEFAULT_CLASSIFICATION,
  NRHP_MPL_SOURCE_ID,
  NRHP_MPL_ORGANIZATION_ID,
  NRHP_MPL_REGISTRY_ENTRY_ID,
  NRHP_MPL_RIGHTS,
  NRHP_MPL_FORBIDDEN_PAYLOAD_KEYS,
  NRHP_MPL_AA_CURATED_THEMES,
  NRHP_MPL_AA_RELEVANCE_LEVELS,
  createNrhpMplEvidenceSource,
  isNrhpMplAaCuratedTheme,
  qualifiesForAaCuratedNet,
  type NrhpMplAaCuratedTheme,
  type NrhpMplAaHeritageRelevance,
} from './definition.js';

export { NRHP_MPL_ATTRIBUTION_NOTICE, createNrhpMplAdapterContract } from './contract.js';

export {
  normalizeNrhpMplRecord,
  parseNrhpMplFixtureBatch,
  assertNrhpMplCandidate,
} from './normalizer.js';

export type {
  NrhpMplRawRecord,
  NrhpMplRejectedRecord,
  NrhpMplParseResult,
  NrhpMplCandidatePayload,
  NrhpMplCandidateRecord,
} from './types.js';

import { registerSource, type SourceRegistryEntry, type SourceRegistryStore } from '../registry.js';
import { createNrhpMplAdapterContract } from './contract.js';
import {
  createNrhpMplEvidenceSource,
  NRHP_MPL_REGISTRY_ENTRY_ID,
} from './definition.js';

export type RegisterNrhpMplAdapterInput = {
  readonly store: SourceRegistryStore;
  readonly createdAt: string;
  readonly registryEntryId?: string;
};

/** Registers the NRHP MPL adapter in `disabled` state. Does not approve policy. */
export function registerNrhpMplAdapter(input: RegisterNrhpMplAdapterInput): SourceRegistryEntry {
  const contract = createNrhpMplAdapterContract();
  const evidenceSource = createNrhpMplEvidenceSource();
  return registerSource(input.store, {
    id: input.registryEntryId ?? NRHP_MPL_REGISTRY_ENTRY_ID,
    contract,
    evidenceSource: {
      ...evidenceSource,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    registryState: 'disabled',
    createdAt: input.createdAt,
  });
}

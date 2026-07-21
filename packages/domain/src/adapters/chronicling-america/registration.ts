/**
 * Disabled-by-default registry registration for the Chronicling America adapter.
 */
import type { EvidenceSource } from '../../provenance/source.js';
import {
  registerSource,
  type SourceRegistryStore,
} from '../registry.js';
import type { SourceRegistryEntry } from '../types.js';
import { createChroniclingAmericaAdapterContract } from './contract.js';
import { chroniclingAmericaAdapterDefinition } from './definition.js';
import {
  CHRONICLING_AMERICA_ADAPTER_ID,
  CHRONICLING_AMERICA_ORG_ID,
  CHRONICLING_AMERICA_SOURCE_ID,
} from './types.js';

export type RegisterChroniclingAmericaSourceInput = {
  readonly id?: string;
  readonly sourceId?: string;
  readonly organizationId?: string;
  readonly createdAt: string;
};

export function registerChroniclingAmericaSource(
  store: SourceRegistryStore,
  input: RegisterChroniclingAmericaSourceInput,
): SourceRegistryEntry {
  const contract = createChroniclingAmericaAdapterContract();
  const definition = chroniclingAmericaAdapterDefinition;

  const evidenceSource: EvidenceSource = {
    id: input.sourceId ?? CHRONICLING_AMERICA_SOURCE_ID,
    organizationId: input.organizationId ?? CHRONICLING_AMERICA_ORG_ID,
    displayName: definition.evidenceSource.displayName,
    classification: definition.evidenceSource.classification,
    adapterId: CHRONICLING_AMERICA_ADAPTER_ID,
    stableIdScheme: definition.evidenceSource.stableIdScheme,
    policy: definition.evidenceSource.policy,
    adapterEnabled: false,
    killSwitchId: definition.killSwitchId,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  return registerSource(store, {
    id: input.id ?? 'reg_chronicling_america',
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: input.createdAt,
  });
}

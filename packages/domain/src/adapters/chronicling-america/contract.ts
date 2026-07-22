/**
 * Chronicling America adapter contract defaults aligned with SourceAdapterContract.
 * Starts disabled by default and requires an approved policy before it may run (../gates.ts).
 * Distinct from the fixture-only federal LoC adapter (`../federal/loc/definition.ts`,
 * adapterId `loc-collections-v1`) — this one targets the historic newspapers collection.
 */
import type { SourceAdapterContract } from '../types.js';
import { chroniclingAmericaAdapterDefinition } from './definition.js';

export function createChroniclingAmericaAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    ...chroniclingAmericaAdapterDefinition.contract,
    ...overrides,
  };
}

/**
 * In-memory source registry with register/get/list/approve policy.
 * Firestore persistence implements SourceRegistryStore in a later.
 */
import { assertEvidenceSourceValid } from '../provenance/source.js';
import { assertSourceAdapterContractValid } from './contract.js';
import type { AdapterRegistryState, SourceAdapterContract, SourceRegistryEntry } from './types.js';

export type RegisterSourceInput = {
  readonly id: string;
  readonly contract: SourceAdapterContract;
  readonly evidenceSource: SourceRegistryEntry['evidenceSource'];
  readonly registryState?: AdapterRegistryState;
  readonly createdAt: string;
};

export type ApproveSourcePolicyInput = {
  readonly id: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly registryState?: Extract<AdapterRegistryState, 'approved' | 'canary'>;
};

/** Persistence boundary for registry entries (Firestore adapter implements later). */
export type SourceRegistryStore = {
  get(id: string): SourceRegistryEntry | undefined;
  list(): readonly SourceRegistryEntry[];
  save(entry: SourceRegistryEntry): void;
};

export function createInMemorySourceRegistry(
  seed: readonly SourceRegistryEntry[] = [],
): SourceRegistryStore {
  const entries = new Map<string, SourceRegistryEntry>(seed.map((entry) => [entry.id, entry]));
  return {
    get(id: string) {
      return entries.get(id);
    },
    list() {
      return [...entries.values()];
    },
    save(entry: SourceRegistryEntry) {
      entries.set(entry.id, entry);
    },
  };
}

export function registerSource(
  store: SourceRegistryStore,
  input: RegisterSourceInput,
): SourceRegistryEntry {
  assertSourceAdapterContractValid(input.contract);
  assertEvidenceSourceValid(input.evidenceSource);
  if (input.evidenceSource.adapterId !== input.contract.adapterId) {
    throw new Error(
      `evidenceSource.adapterId (${input.evidenceSource.adapterId}) must match contract.adapterId (${input.contract.adapterId})`,
    );
  }
  if (store.get(input.id)) {
    throw new Error(`Source registry entry already exists: ${input.id}`);
  }
  const entry: SourceRegistryEntry = {
    id: input.id,
    contract: input.contract,
    evidenceSource: input.evidenceSource,
    registryState: input.registryState ?? 'disabled',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  store.save(entry);
  return entry;
}

export function getSourceEntry(store: SourceRegistryStore, id: string): SourceRegistryEntry | undefined {
  return store.get(id);
}

export function listSourceEntries(
  store: SourceRegistryStore,
  filter?: { readonly registryState?: AdapterRegistryState },
): readonly SourceRegistryEntry[] {
  const all = store.list();
  if (!filter?.registryState) {
    return all;
  }
  return all.filter((entry) => entry.registryState === filter.registryState);
}

export function approveSourcePolicy(
  store: SourceRegistryStore,
  input: ApproveSourcePolicyInput,
): SourceRegistryEntry {
  const existing = store.get(input.id);
  if (!existing) {
    throw new Error(`Source registry entry not found: ${input.id}`);
  }
  if (existing.registryState === 'quarantined' || existing.registryState === 'dead_letter') {
    throw new Error(
      `Cannot approve source policy in state "${existing.registryState}"; resolve quarantine/dead-letter first`,
    );
  }
  const updated: SourceRegistryEntry = {
    ...existing,
    registryState: input.registryState ?? 'approved',
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    updatedAt: input.approvedAt,
  };
  store.save(updated);
  return updated;
}

export function setRegistryState(
  store: SourceRegistryStore,
  input: {
    readonly id: string;
    readonly registryState: AdapterRegistryState;
    readonly updatedAt: string;
    readonly quarantineReason?: string;
    readonly deadLetterReason?: string;
  },
): SourceRegistryEntry {
  const existing = store.get(input.id);
  if (!existing) {
    throw new Error(`Source registry entry not found: ${input.id}`);
  }
  const updated: SourceRegistryEntry = {
    ...existing,
    registryState: input.registryState,
    updatedAt: input.updatedAt,
    ...(input.quarantineReason ? { quarantineReason: input.quarantineReason } : {}),
    ...(input.deadLetterReason ? { deadLetterReason: input.deadLetterReason } : {}),
  };
  store.save(updated);
  return updated;
}

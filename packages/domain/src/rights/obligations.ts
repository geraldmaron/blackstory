/**
 * Per-source legal/contractual obligations registry.
 *
 * Extends the rights model (../provenance/rights.js,../provenance/source.js) with
 * per-source-class obligations that the crowdsource/UGC lane must honor:
 * deletion-sync windows, republication/ML-training prohibitions, storage-rights-tier gates,
 * and attribution/liveness re-check requirements.
 *
 * This mirrors the adapter registry's fail-closed pattern exactly
 * (../adapters/registry.ts,../adapters/gates.ts assertAdapterMayRun): a lookup with no
 * matching entry throws rather than defaulting to "no obligations". An adapter cannot run
 * without both an approved registry entry *and* a registered obligations entry.
 */

/** Named source classes the calls out explicitly; extend as new UGC adapters land. */
export const OBLIGATION_SOURCE_CLASSES = [
  'reddit',
  'searxng_search',
  'brave_search',
  'exa_search',
  'rss',
  'internet_archive',
  'dpla',
] as const;

export type ObligationSourceClass = (typeof OBLIGATION_SOURCE_CLASSES)[number];

export type DeletionSyncObligation = {
  /** True when the deletion-sync framework (./deletion-sync.js) must purge on upstream deletion. */
  readonly required: boolean;
  /** Maximum hours between upstream deletion and purge completion, when required. */
  readonly maxHours?: number;
  /** True when this obligation is contractual and binding regardless of privacy-law analysis. */
  readonly contractual: boolean;
  readonly notes?: string;
};

export type SourceObligations = {
  /** Matches SourceAdapterContract.adapterId EvidenceSource.adapterId. */
  readonly adapterId: string;
  readonly sourceClass: ObligationSourceClass;
  readonly deletionSync: DeletionSyncObligation;
  /** No republication of substantial content beyond the evidence-pointer doctrine. */
  readonly republicationProhibited: boolean;
  /** No use of this source's content for ML training. */
  readonly mlTrainingProhibited: boolean;
  /** A resolved storage-rights tier is required before caching beyond a pointer/snippet. */
  readonly storageRightsTierRequired: boolean;
  readonly attributionRequired: boolean;
  /** Periodic re-check that the underlying source item account still exists and is public. */
  readonly livenessRecheckRequired: boolean;
  readonly livenessRecheckIntervalDays?: number;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Persistence boundary mirrors SourceRegistryStore (../adapters/registry.ts). */
export type ObligationsRegistryStore = {
  get(adapterId: string): SourceObligations | undefined;
  list(): readonly SourceObligations[];
  save(entry: SourceObligations): void;
};

export function createInMemoryObligationsRegistry(
  seed: readonly SourceObligations[] = [],
): ObligationsRegistryStore {
  const entries = new Map<string, SourceObligations>(seed.map((entry) => [entry.adapterId, entry]));
  return {
    get(adapterId) {
      return entries.get(adapterId);
    },
    list() {
      return [...entries.values()];
    },
    save(entry) {
      entries.set(entry.adapterId, entry);
    },
  };
}

export function registerSourceObligations(
  store: ObligationsRegistryStore,
  entry: SourceObligations,
): SourceObligations {
  if (store.get(entry.adapterId)) {
    throw new Error(`Obligations entry already exists for adapter: ${entry.adapterId}`);
  }
  store.save(entry);
  return entry;
}

export function hasSourceObligationsEntry(
  store: ObligationsRegistryStore,
  adapterId: string,
): boolean {
  return store.get(adapterId) !== undefined;
}

/**
 * Fail-closed lookup: an adapter without a registered obligations entry cannot run.
 * Mirrors assertAdapterMayRun's fail-closed shape (../adapters/gates.ts).
 */
export function getSourceObligationsOrThrow(
  store: ObligationsRegistryStore,
  adapterId: string,
): SourceObligations {
  const entry = store.get(adapterId);
  if (!entry) {
    throw new Error(
      `Source adapter "${adapterId}" has no registered obligations entry; adapters cannot run ` +
        'without one ( fail-closed, mirrors the  registry pattern)',
    );
  }
  return entry;
}

/** Fail-closed gate for callers that only need a boolean-or-throw check. */
export function assertAdapterHasObligations(
  store: ObligationsRegistryStore,
  adapterId: string,
): void {
  getSourceObligationsOrThrow(store, adapterId);
}

/**
 * Default obligations seed for the sources named in the. `seedAt` is supplied by
 * the caller so seeding stays deterministic in tests and reproducible in migrations.
 */
export function defaultSourceObligationsSeed(seedAt: string): readonly SourceObligations[] {
  return [
    {
      adapterId: 'reddit',
      sourceClass: 'reddit',
      deletionSync: {
        required: true,
        maxHours: 48,
        contractual: true,
        notes:
          "Reddit's API/developer terms require deletion sync within 48 hours of upstream " +
          'deletion, independent of any CPRA publicly-available-information analysis ' +
          '(see docs/security/ugc-legal-posture.md).',
      },
      republicationProhibited: true,
      mlTrainingProhibited: true,
      storageRightsTierRequired: false,
      attributionRequired: true,
      livenessRecheckRequired: true,
      livenessRecheckIntervalDays: 7,
      notes: 'Gated channel ().',
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'searxng_search',
      sourceClass: 'searxng_search',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: true,
      mlTrainingProhibited: false,
      storageRightsTierRequired: true,
      attributionRequired: true,
      livenessRecheckRequired: false,
      notes:
        'Self-hosted SearXNG. Operator must confirm upstream-engine policy before caching ' +
        'beyond the evidence-pointer doctrine (../rights/evidence-pointer.js).',
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'brave_search',
      sourceClass: 'brave_search',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: true,
      mlTrainingProhibited: false,
      storageRightsTierRequired: true,
      attributionRequired: true,
      livenessRecheckRequired: false,
      notes:
        'Requires a resolved storage-rights tier before any result may be cached beyond the ' +
        'evidence-pointer doctrine (../rights/evidence-pointer.js).',
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'exa_search',
      sourceClass: 'exa_search',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: true,
      mlTrainingProhibited: false,
      storageRightsTierRequired: true,
      attributionRequired: true,
      livenessRecheckRequired: false,
      notes:
        'Requires a resolved storage-rights tier before any result may be cached beyond the ' +
        'evidence-pointer doctrine (../rights/evidence-pointer.js).',
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'rss',
      sourceClass: 'rss',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: false,
      mlTrainingProhibited: false,
      storageRightsTierRequired: false,
      attributionRequired: true,
      livenessRecheckRequired: true,
      livenessRecheckIntervalDays: 30,
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'internet_archive',
      sourceClass: 'internet_archive',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: false,
      mlTrainingProhibited: false,
      storageRightsTierRequired: false,
      attributionRequired: true,
      livenessRecheckRequired: true,
      livenessRecheckIntervalDays: 90,
      createdAt: seedAt,
      updatedAt: seedAt,
    },
    {
      adapterId: 'dpla',
      sourceClass: 'dpla',
      deletionSync: { required: false, contractual: false },
      republicationProhibited: false,
      mlTrainingProhibited: false,
      storageRightsTierRequired: false,
      attributionRequired: true,
      livenessRecheckRequired: true,
      livenessRecheckIntervalDays: 90,
      createdAt: seedAt,
      updatedAt: seedAt,
    },
  ];
}

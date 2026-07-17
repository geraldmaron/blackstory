/**
 * BB-082's own source registrations for datasets with specific citation requirements: EJI
 * (Seguin-Rigby lynching records) and the Tougaloo College Historical Database of Sundown Towns.
 *
 * BOUNDARY (mirrors ../launch-corpora.ts's own boundary rule exactly): Mapping Inequality (HOLC
 * redlining, Univ. of Richmond DSL/NARA) and the EJI-linked "documented massacres and riots"
 * corpus are ALREADY registered ONCE through the BB-037/BB-094 launch-corpus lane
 * (`../launch-corpora.ts`'s `mapping-inequality-holc` and `documented-massacres-riots`, AC12).
 * This module never re-registers them \u2014 `referenceExistingLaunchCorpus` below only points at
 * their existing `corpusSourceRegistryEntryId`, exactly as `mapping-inequality-holc`'s own
 * `boundaryNotes` field already documents ("referenced by BB-082, never re-ingested by BB-082 as
 * a second copy").
 *
 * Tougaloo sundown-town data is explicitly EXCLUDED from that lane
 * (`../corpus-vetting.ts`'s `EXCLUDED_CORPUS_LANES` regex-matches `tougaloo` and reserves it for
 * this module) because it is not a bulk-geometry corpus import \u2014 it is individual,
 * claims-with-confidence town designations (../layer-record.ts's `SundownTownDesignationRecord`).
 * EJI's lynching-record dataset (distinct from the already-registered massacres/riots corpus)
 * gets the same treatment: its own BB-082-owned registration, with EJI's specific citation terms
 * recorded verbatim.
 */
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryStore,
} from '../adapters/registry.js';
import { corpusSourceRegistryEntryId } from '../corpus-vetting.js';
import type { RateLimitPolicy, SourceAdapterContract } from '../adapters/types.js';
import type { RightsPolicy } from '../provenance/rights.js';
import type { HistoricSafetyLayerId } from './types.js';

// ---------------------------------------------------------------------------
// References to already-registered BB-094 launch corpora (read-only pointers, no re-registration)
// ---------------------------------------------------------------------------

/** Launch-corpus slugs this engine's layers draw on without re-registering (AC12 boundary rule). */
export const REFERENCED_LAUNCH_CORPUS_SLUGS = {
  exclusion_infrastructure: 'mapping-inequality-holc',
  documented_events_massacres_riots: 'documented-massacres-riots',
} as const;

/** Resolves the BB-037 registry entry id an already-registered BB-094 launch corpus uses \u2014
 *  a pure pointer helper, never a second registration. */
export function referencedLaunchCorpusRegistryEntryId(
  corpusSlug: (typeof REFERENCED_LAUNCH_CORPUS_SLUGS)[keyof typeof REFERENCED_LAUNCH_CORPUS_SLUGS],
): string {
  return corpusSourceRegistryEntryId(corpusSlug);
}

// ---------------------------------------------------------------------------
// BB-082-owned registrations: EJI lynching records, Tougaloo sundown towns
// ---------------------------------------------------------------------------

export const HISTORIC_SAFETY_SOURCE_IDS = ['eji-lynching-records', 'tougaloo-sundown-towns'] as const;
export type HistoricSafetySourceId = (typeof HISTORIC_SAFETY_SOURCE_IDS)[number];

export function isHistoricSafetySourceId(value: string): value is HistoricSafetySourceId {
  return (HISTORIC_SAFETY_SOURCE_IDS as readonly string[]).includes(value);
}

/**
 * One registration per BB-082-owned dataset: custodian, licensing notes, the layer it feeds, and
 * MANDATORY citation requirements (unlike ../corpus-vetting.ts's `CorpusVettingRecord`, where
 * `citationRequirements` is optional \u2014 EJI and Tougaloo both have specific, non-optional
 * citation terms per the bead's own text, so this field is required here).
 */
export type HistoricSafetySourceRegistration = {
  readonly sourceId: HistoricSafetySourceId;
  readonly displayName: string;
  readonly custodian: string;
  readonly feedsLayerId: HistoricSafetyLayerId;
  readonly citationRequirements: string;
  readonly licenseNotes: string;
  readonly refreshCadence: string;
  /** BB-037 registry entry id this registration is backed by (see `registerHistoricSafetySource`). */
  readonly sourceRegistryEntryId: string;
  readonly registeredBy: string;
  readonly registeredAt: string;
};

export function assertHistoricSafetySourceRegistrationValid(
  registration: HistoricSafetySourceRegistration,
): void {
  if (!isHistoricSafetySourceId(registration.sourceId)) {
    throw new Error(`Unknown historic-safety source id: ${registration.sourceId}`);
  }
  if (!registration.displayName.trim()) throw new Error('displayName is required');
  if (!registration.custodian.trim()) throw new Error('custodian is required');
  if (!registration.citationRequirements.trim()) {
    throw new Error(
      `Historic-safety source "${registration.sourceId}" requires non-blank citationRequirements ` +
        '\u2014 EJI and Tougaloo both have specific citation terms that must be recorded (AC3).',
    );
  }
  if (!registration.licenseNotes.trim()) throw new Error('licenseNotes is required');
  if (!registration.refreshCadence.trim()) throw new Error('refreshCadence is required');
  if (!Number.isFinite(Date.parse(registration.registeredAt))) {
    throw new Error('registeredAt must be an ISO date');
  }
}

export type HistoricSafetySourceRegistryStore = {
  get(sourceId: HistoricSafetySourceId): HistoricSafetySourceRegistration | undefined;
  list(): readonly HistoricSafetySourceRegistration[];
  save(registration: HistoricSafetySourceRegistration): void;
};

export function createInMemoryHistoricSafetySourceRegistryStore(
  seed: readonly HistoricSafetySourceRegistration[] = [],
): HistoricSafetySourceRegistryStore {
  const registrations = new Map<HistoricSafetySourceId, HistoricSafetySourceRegistration>(
    seed.map((r) => [r.sourceId, r]),
  );
  return {
    get(sourceId) {
      return registrations.get(sourceId);
    },
    list() {
      return [...registrations.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    },
    save(registration) {
      assertHistoricSafetySourceRegistrationValid(registration);
      registrations.set(registration.sourceId, registration);
    },
  };
}

function historicSafetySourceRegistryEntryId(sourceId: HistoricSafetySourceId): string {
  return `historic_safety_source_registry:${sourceId}`;
}

export type RegisterHistoricSafetySourceInput = {
  readonly sourceId: HistoricSafetySourceId;
  readonly displayName: string;
  readonly custodian: string;
  readonly feedsLayerId: HistoricSafetyLayerId;
  readonly citationRequirements: string;
  readonly licenseNotes: string;
  readonly refreshCadence: string;
  readonly classification: string;
  readonly rights: RightsPolicy;
  readonly permittedClaimClasses: readonly string[];
  readonly stableIdScheme: string;
  readonly organizationId: string;
  readonly rateLimits?: RateLimitPolicy;
  readonly registeredBy: string;
  readonly registeredAt: string;
};

/**
 * Registers a BB-082-owned dataset through the SAME low-level BB-037 registry primitive every
 * other adapter uses (`registerSource`, `../adapters/registry.js`) \u2014 approved immediately
 * (BB-082's own registrations are not subject to BB-094's bulk-import license-verdict gate,
 * which is a different gate for a different lane) \u2014 and records the citation-requirement
 * metadata alongside it.
 */
export function registerHistoricSafetySource(
  registryStore: SourceRegistryStore,
  sourceRegistryStore: HistoricSafetySourceRegistryStore,
  input: RegisterHistoricSafetySourceInput,
): HistoricSafetySourceRegistration {
  const registryEntryId = historicSafetySourceRegistryEntryId(input.sourceId);
  const adapterId = `historic-safety:${input.sourceId}`;

  const policy = {
    snapshotMode: 'selective' as const,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshCadence,
    notes: `BB-082 historic-safety source "${input.sourceId}"; custodian: ${input.custodian}.`,
  };

  const contract: SourceAdapterContract = {
    adapterId,
    parserVersion: 'historic-safety-source-v1',
    displayName: input.displayName,
    classification: input.classification,
    stableIdScheme: input.stableIdScheme,
    policy,
    rights: input.rights,
    permittedClaimClasses: input.permittedClaimClasses,
    refreshSchedule: input.refreshCadence,
    rateLimits: input.rateLimits ?? { requestsPerMinute: 1 },
    volume: { expectedRecordsPerRun: 0, countToleranceFraction: 1 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: 'historic-safety-source-v1',
  };

  registerSource(registryStore, {
    id: registryEntryId,
    contract,
    evidenceSource: {
      id: registryEntryId,
      organizationId: input.organizationId,
      displayName: input.displayName,
      classification: input.classification,
      adapterId,
      stableIdScheme: input.stableIdScheme,
      policy,
      adapterEnabled: true,
      createdAt: input.registeredAt,
      updatedAt: input.registeredAt,
    },
    createdAt: input.registeredAt,
  });
  approveSourcePolicy(registryStore, {
    id: registryEntryId,
    approvedBy: input.registeredBy,
    approvedAt: input.registeredAt,
  });

  const registration: HistoricSafetySourceRegistration = {
    sourceId: input.sourceId,
    displayName: input.displayName,
    custodian: input.custodian,
    feedsLayerId: input.feedsLayerId,
    citationRequirements: input.citationRequirements,
    licenseNotes: input.licenseNotes,
    refreshCadence: input.refreshCadence,
    sourceRegistryEntryId: registryEntryId,
    registeredBy: input.registeredBy,
    registeredAt: input.registeredAt,
  };
  sourceRegistryStore.save(registration);
  return registration;
}

/**
 * Registration inputs for both BB-082-owned sources, ready for a caller to pass to
 * `registerHistoricSafetySource` (mirrors `../launch-corpora.ts`'s
 * `buildLaunchCorpusVettingInputs` shape/convention). `rights`/`permittedClaimClasses` are
 * supplied by the caller so a real registration always carries an accountable, reviewed rights
 * decision rather than a baked-in default.
 */
export function buildHistoricSafetySourceRegistrationInputs(input: {
  readonly registeredBy: string;
  readonly registeredAt: string;
  readonly rights: RightsPolicy;
}): readonly RegisterHistoricSafetySourceInput[] {
  const { registeredBy, registeredAt, rights } = input;
  return [
    {
      sourceId: 'eji-lynching-records',
      displayName: 'Equal Justice Initiative \u2014 Lynching in America (Seguin-Rigby dataset)',
      custodian: 'Equal Justice Initiative (EJI)',
      feedsLayerId: 'documented_events',
      citationRequirements:
        'Cite "Equal Justice Initiative, Lynching in America" (or the specific EJI/Seguin-Rigby ' +
        'dataset release) with a link to eji.org; EJI report content is link+attribute only per ' +
        'EJI\'s terms \u2014 never bulk-reproduced (matches ../launch-corpora.ts\'s ' +
        '`documented-massacres-riots` citation convention for the same custodian).',
      licenseNotes:
        'EJI dataset content is link+attribute only; underlying corroborating primary records ' +
        '(NPS, state archives) are public domain / government record and may be cited directly.',
      refreshCadence: 'quarterly',
      classification: 'reputable_secondary',
      rights,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
      stableIdScheme: 'eji-lynching-record-ref',
      organizationId: 'org_eji',
      registeredBy,
      registeredAt,
    },
    {
      sourceId: 'tougaloo-sundown-towns',
      displayName: 'Tougaloo College Historical Database of Sundown Towns',
      custodian: 'Tougaloo College',
      feedsLayerId: 'sundown_town',
      citationRequirements:
        'Cite "Tougaloo College Historical Database of Sundown Towns" by name with a link to the ' +
        'database entry; preserve the possible/probable/surely confidence label verbatim in any ' +
        'citation \u2014 never restate it as a boolean claim.',
      licenseNotes:
        'Individual town-level designations with a documented confidence label; not a bulk-' +
        'geometry corpus \u2014 excluded from the ../corpus-vetting.ts BB-094 lane by design ' +
        '(`EXCLUDED_CORPUS_LANES`), registered here instead.',
      refreshCadence: 'quarterly',
      classification: 'reputable_secondary',
      rights,
      permittedClaimClasses: ['geographic_fact'],
      stableIdScheme: 'tougaloo-sundown-town-id',
      organizationId: 'org_tougaloo',
      registeredBy,
      registeredAt,
    },
  ];
}

/** Registers both BB-082-owned sources in one step; returns the registrations in list order. */
export function registerHistoricSafetySources(
  registryStore: SourceRegistryStore,
  sourceRegistryStore: HistoricSafetySourceRegistryStore,
  input: { readonly registeredBy: string; readonly registeredAt: string; readonly rights: RightsPolicy },
): readonly HistoricSafetySourceRegistration[] {
  return buildHistoricSafetySourceRegistrationInputs(input).map((sourceInput) =>
    registerHistoricSafetySource(registryStore, sourceRegistryStore, sourceInput),
  );
}

export { createInMemorySourceRegistry };

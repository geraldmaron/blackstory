/**
 * Finding-aid (EAD/XML + OAI-PMH) source adapter public surface for the County Archive Ladder
 * research-discovery methodology.
 *
 * County and state historical-society archives publish EAD (Encoded Archival Description) finding
 * aids and OAI-PMH feeds that describe collections holding micro-histories — local NAACP founders,
 * neighborhood business owners, church leaders, county-level school-desegregation plaintiffs — that
 * are absent from federal aggregator databases. This adapter normalizes finding-aid *metadata and
 * evidence pointers* into private discovery candidates.
 *
 * Invariants (ADR-009 + constitution):
 * - Self-contained module. Does NOT edit any barrel; parent wires the export lines from the doc.
 * - Registers DISABLED. `assertAdapterMayRun` / `approveSourcePolicy` gate any real run.
 * - Metadata + canonical finding-aid URLs only — never bulk OCR / full container-list text.
 * - Discovery produces private candidates only; never a publish path.
 * - Live harvesting MUST use @repo/security safe-fetch (see FindingAidAdapter contract note);
 *   this module ships fixture-first and injects the adapter, so it performs no network I/O itself.
 *
 * Research-kernel alignment: state/county historical societies are a `scholarly` source class
 * (see `packages/research-kernel/profiles/black-history.v1.json` → sourceFitness `scholarly`,
 * fitness `strong`). The provenance-layer `EvidenceSource.classification` is a constitution
 * classification; finding aids describe primary archival holdings, so it maps to
 * `primary_archival`.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION, stampCandidateProvenance } from '../candidates.js';
import {
  registerSource,
  type SourceRegistryStore,
} from '../registry.js';
import type { AdapterCandidateRecord, SourceAdapterContract, SourceRegistryEntry } from '../types.js';
import type { EvidenceSource } from '../../provenance/source.js';
import type { RightsPolicy } from '../../provenance/rights.js';
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../../rights/evidence-pointer.js';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const FINDING_AID_ADAPTER_ID = 'finding-aid-v1' as const;
export const FINDING_AID_PARSER_VERSION = 'finding-aid-parser-1.0.0' as const;
export const FINDING_AID_STABLE_ID_SCHEME = 'finding-aid-ead-id' as const;
export const FINDING_AID_PAYLOAD_SCHEMA_VERSION = 'finding-aid-payload.v1' as const;

/**
 * Research-kernel source class for state/county archives. Distinct from the constitution's
 * provenance classification below.
 */
export const FINDING_AID_SOURCE_CLASS = 'scholarly' as const;

/** Constitution provenance classification for finding-aid-described archival holdings. */
export const FINDING_AID_DEFAULT_CLASSIFICATION = 'primary_archival' as const;

export const FINDING_AID_KILL_SWITCH_ID = 'adapter:finding_aid' as const;

/**
 * Finding-aid content is mixed-rights descriptive metadata; store pointers + capped snippets only.
 * Publication rights are resolved per-item downstream, never assumed at discovery time.
 */
export const FINDING_AID_RIGHTS: RightsPolicy = {
  defaultStatus: 'unknown',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication', 'commercial_reuse', 'biometric_extraction'],
};

/** Keys that must never persist from finding-aid harvests (bulk full text is out of scope). */
export const FINDING_AID_FORBIDDEN_PAYLOAD_KEYS = [
  'fullText',
  'ocrText',
  'containerListText',
  'scopeAndContentFull',
  'pdfBytes',
  'binaryBlob',
  'attachments',
] as const;

export type FindingAidProtocol = 'ead-xml' | 'oai-pmh';

// ---------------------------------------------------------------------------
// FindingAidSource contract (a registered state/county archive)
// ---------------------------------------------------------------------------

/**
 * A registered finding-aid source: one state or county historical-society archive that exposes
 * EAD/XML finding aids and/or an OAI-PMH endpoint. Seeds live in
 * `fixtures/state-archive-seed.v1.json`.
 */
export type FindingAidSource = {
  /** Short stable slug, e.g. `adah`. */
  readonly id: string;
  /** Registry entry id, e.g. `reg_finding_aid_adah`. */
  readonly registryEntryId: string;
  /** Evidence-source id, e.g. `src_finding_aid_adah`. */
  readonly sourceId: string;
  readonly organizationId: string;
  readonly displayName: string;
  /** Primary jurisdiction as an ISO-3166-2 code, e.g. `US-AL`. */
  readonly state: string;
  /** Public finding-aid portal / EAD base URL. */
  readonly findingAidBaseUrl: string;
  /** Public OAI-PMH endpoint when the institution confirms one. */
  readonly oaiPmhEndpoint?: string;
  readonly protocol: FindingAidProtocol;
  /** Research-kernel source class; always `scholarly` for this methodology. */
  readonly sourceClass?: typeof FINDING_AID_SOURCE_CLASS;
  /** Constitution provenance classification override (defaults to `primary_archival`). */
  readonly classification?: string;
  readonly notes?: string;
};

/**
 * A collection described by a finding aid, returned by `FindingAidAdapter.listCollections`.
 */
export type FindingAidCollection = {
  readonly sourceId: string;
  readonly collectionId: string;
  readonly title: string;
  readonly repository: string;
  readonly state: string;
  /** Canonical finding-aid URL (EAD/XML or HTML) for this collection. */
  readonly findingAidUrl: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
};

/**
 * A discovery candidate extracted from a finding aid (a component/series/item level description).
 * Snippet-only: `summary` is a short scope-and-content abstract, never a full container list.
 */
export type FindingAidCandidateInput = {
  readonly stableIdentifier?: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly repository: string;
  readonly collectionId: string;
  readonly state: string;
  readonly summary?: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
  /** EAD component id or finding-aid unitid. */
  readonly eadComponentId?: string;
  readonly classification?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
};

export type FindingAidCandidatePayload = {
  readonly schemaVersion: typeof FINDING_AID_PAYLOAD_SCHEMA_VERSION;
  readonly repository: string;
  readonly collectionId: string;
  readonly state: string;
  readonly summary?: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
  readonly eadComponentId?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
};

export type FindingAidCandidateRecord = AdapterCandidateRecord & {
  readonly payload: FindingAidCandidatePayload;
};

/**
 * Pluggable harvester interface. Deterministic/fixture implementations are injected in tests;
 * a live implementation MUST use `@repo/security` safe-fetch for every EAD/OAI request and MUST
 * NOT be constructed from raw `fetch`.
 */
export interface FindingAidAdapter {
  readonly adapterId: string;
  /** List collections a state/county archive exposes for the given jurisdiction. */
  listCollections(
    state: string,
  ): Promise<readonly FindingAidCollection[]> | readonly FindingAidCollection[];
  /** Extract candidate component descriptions from a single collection's finding aid. */
  extractCandidates(
    collection: FindingAidCollection,
  ): Promise<readonly FindingAidCandidateInput[]> | readonly FindingAidCandidateInput[];
}

// ---------------------------------------------------------------------------
// Contract + evidence source construction
// ---------------------------------------------------------------------------

export function createFindingAidAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: FINDING_AID_ADAPTER_ID,
    parserVersion: FINDING_AID_PARSER_VERSION,
    displayName: 'County/State Archive Finding Aids (EAD/OAI-PMH)',
    classification: FINDING_AID_DEFAULT_CLASSIFICATION,
    stableIdScheme: FINDING_AID_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: FINDING_AID_RIGHTS,
      permittedClaimClasses: ['institutional_fact', 'biographical_fact', 'geographic_fact'],
      refreshSchedule: '0 6 15 * *',
      notes:
        'County Archive Ladder finding-aid harvest. Research-kernel sourceClass=scholarly. ' +
        'Metadata + canonical finding-aid URLs + capped scope-and-content snippets only — ' +
        'never bulk OCR / full container-list text. Fixtures-first; do not enable without ' +
        'explicit policy approval and safe-fetch-backed live adapter.',
    },
    rights: FINDING_AID_RIGHTS,
    permittedClaimClasses: ['institutional_fact', 'biographical_fact', 'geographic_fact'],
    refreshSchedule: '0 6 15 * *',
    rateLimits: { requestsPerMinute: 6, burst: 2 },
    volume: { expectedRecordsPerRun: 40, countToleranceFraction: 0.5 },
    geographicCoverage: {
      countries: ['US'],
      notes: 'U.S. county/state historical-society finding aids (EAD/OAI-PMH).',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.1,
    ...overrides,
  };
}

export function createFindingAidEvidenceSource(
  source: FindingAidSource,
  now: string,
): EvidenceSource {
  return {
    id: source.sourceId,
    organizationId: source.organizationId,
    displayName: source.displayName,
    classification: source.classification ?? FINDING_AID_DEFAULT_CLASSIFICATION,
    adapterId: FINDING_AID_ADAPTER_ID,
    stableIdScheme: FINDING_AID_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: FINDING_AID_RIGHTS,
      permittedClaimClasses: ['institutional_fact', 'biographical_fact', 'geographic_fact'],
      refreshSchedule: '0 6 15 * *',
      notes:
        `Finding-aid source for ${source.displayName} (${source.state}); research-kernel ` +
        'sourceClass=scholarly; metadata + pointers only; fixtures-first; disabled until approval.',
    },
    adapterEnabled: true,
    killSwitchId: FINDING_AID_KILL_SWITCH_ID,
    createdAt: now,
    updatedAt: now,
  };
}

export type RegisterFindingAidSourceInput = {
  readonly store: SourceRegistryStore;
  readonly source: FindingAidSource;
  readonly createdAt: string;
  readonly contractOverrides?: Partial<SourceAdapterContract>;
};

/**
 * Registers one finding-aid source in `disabled` state. Wraps `registerSource` with
 * research-kernel sourceClass=scholarly. Does NOT approve policy — approval is a separate,
 * human/campaign-time step (`approveSourcePolicy`).
 */
export function registerFindingAidSource(
  input: RegisterFindingAidSourceInput,
): SourceRegistryEntry {
  const contract = createFindingAidAdapterContract(input.contractOverrides);
  const evidenceSource = createFindingAidEvidenceSource(input.source, input.createdAt);
  return registerSource(input.store, {
    id: input.source.registryEntryId,
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: input.createdAt,
  });
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function capSnippet(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  const byWords = collapsed.split(' ').slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ');
  return byWords.length > MAX_EVIDENCE_SNIPPET_CHARACTERS
    ? byWords.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS).trimEnd()
    : byWords;
}

function buildStableIdentifier(input: FindingAidCandidateInput): string {
  const explicit = input.stableIdentifier?.trim();
  if (explicit) return explicit;
  const component = input.eadComponentId?.trim();
  if (component) return `finding-aid:${input.collectionId}:${component}`;
  return `finding-aid:${input.collectionId}:${input.canonicalUrl}`;
}

function stripForbiddenIdentifiers(
  identifiers: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!identifiers) return undefined;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(identifiers)) {
    if ((FINDING_AID_FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value === 'string' && value.trim()) cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Normalize a single finding-aid candidate input into a provenance-stamped candidate record. */
export function normalizeFindingAidCandidate(input: {
  readonly candidate: FindingAidCandidateInput;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): FindingAidCandidateRecord {
  const { candidate } = input;
  const title = candidate.title?.trim();
  if (!title) {
    throw new Error('Finding-aid candidate requires a title');
  }
  const canonicalUrl = candidate.canonicalUrl?.trim();
  if (!canonicalUrl) {
    throw new Error('Finding-aid candidate requires a canonicalUrl');
  }
  new URL(canonicalUrl); // throws on invalid

  const payload: FindingAidCandidatePayload = {
    schemaVersion: FINDING_AID_PAYLOAD_SCHEMA_VERSION,
    repository: candidate.repository,
    collectionId: candidate.collectionId,
    state: candidate.state,
    ...(candidate.summary !== undefined ? { summary: capSnippet(candidate.summary) } : {}),
    ...(candidate.creator !== undefined ? { creator: candidate.creator } : {}),
    ...(candidate.coveragePeriod !== undefined
      ? { coveragePeriod: candidate.coveragePeriod }
      : {}),
    ...(candidate.eadComponentId !== undefined
      ? { eadComponentId: candidate.eadComponentId }
      : {}),
    ...(() => {
      const ids = stripForbiddenIdentifiers(candidate.identifiers);
      return ids ? { identifiers: ids } : {};
    })(),
  };

  const stamped = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: buildStableIdentifier(candidate),
    title,
    canonicalUrl,
    classification:
      candidate.classification ??
      input.registryEntry.evidenceSource.classification ??
      FINDING_AID_DEFAULT_CLASSIFICATION,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  return stamped as FindingAidCandidateRecord;
}

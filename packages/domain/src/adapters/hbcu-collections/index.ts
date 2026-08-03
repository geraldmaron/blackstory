/**
 * HBCU Special Collections source adapter public surface for the HBCU Special Collections
 * Discovery research methodology.
 *
 * HBCU special collections — Howard's Moorland-Spingarn Research Center, Fisk's Franklin
 * Library, Tuskegee's University Archives, Hampton's University Archives — are among the
 * richest Black history sources in existence and are largely absent from federal aggregator
 * databases. Some surface through DPLA hubs (handled by the DPLA v2 lane of
 * `discovery/hbcu-campaign.ts`); others expose standalone EAD finding aids or local digital
 * repositories that this adapter normalizes into private discovery candidates as *metadata and
 * evidence pointers* only.
 *
 * Invariants (ADR-009 + constitution):
 * - Self-contained module. Does NOT edit any barrel; parent wires the export lines from
 *   `docs/research/hbcu-collections-discovery.md` → Integration.
 * - Deliberately does NOT import from `../finding-aid/` (owned by another methodology); the
 *   small shared shapes are duplicated locally on purpose.
 * - Registers DISABLED. `approveSourcePolicy` / `assertAdapterMayRun` gate any real run.
 * - Metadata + canonical collection/finding-aid URLs + capped snippets only — never bulk OCR,
 *   full container lists, or digitized item bytes.
 * - Discovery produces private candidates only; never a publish path.
 * - Live harvesting MUST use `@repo/security` safe-fetch (see HbcuAdapter contract note); this
 *   module ships fixture-first, injects the adapter, and performs no network I/O itself.
 * - Dignity: HBCU collections describe named people and families. Living-person addresses are
 *   never captured; residence-level identifiers are on the forbidden payload key list.
 *
 * Research-kernel alignment: university special collections are a `scholarly` source class
 * (see `packages/research-kernel/profiles/black-history.v1.json` → sourceFitness `scholarly`
 * → claimClass `historical-synthesis`, fitness `strong`). The provenance-layer
 * `EvidenceSource.classification` is a constitution classification; finding aids and special
 * collections describe primary archival holdings, so the default maps to `primary_archival`.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION, stampCandidateProvenance } from '../candidates.js';
import { registerSource, type SourceRegistryStore } from '../registry.js';
import type {
  AdapterCandidateRecord,
  SourceAdapterContract,
  SourceRegistryEntry,
} from '../types.js';
import type { EvidenceSource } from '../../provenance/source.js';
import type { RightsPolicy } from '../../provenance/rights.js';
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../../rights/evidence-pointer.js';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const HBCU_COLLECTIONS_ADAPTER_ID = 'hbcu-collections-v1' as const;
export const HBCU_COLLECTIONS_PARSER_VERSION = 'hbcu-collections-parser-1.0.0' as const;
export const HBCU_COLLECTIONS_STABLE_ID_SCHEME = 'hbcu-collection-item' as const;
export const HBCU_COLLECTIONS_PAYLOAD_SCHEMA_VERSION = 'hbcu-collections-payload.v1' as const;
export const HBCU_COLLECTIONS_SEED_SCHEMA_VERSION = 'hbcu-collections-seed.v1' as const;

/**
 * Research-kernel source class for HBCU special collections. Maps to sourceFitness
 * `scholarly` → claimClass `historical-synthesis` with fitness `strong` in
 * `black-history.v1.json`. Distinct from the constitution provenance classification below.
 */
export const HBCU_COLLECTIONS_SOURCE_CLASS = 'scholarly' as const;

/** Constitution provenance classification for special-collections archival holdings. */
export const HBCU_COLLECTIONS_DEFAULT_CLASSIFICATION = 'primary_archival' as const;

export const HBCU_COLLECTIONS_KILL_SWITCH_ID = 'adapter:hbcu_collections' as const;

/**
 * Special-collections metadata is mixed-rights; store pointers + capped snippets only.
 * Publication rights are resolved per-item downstream, never assumed at discovery time.
 */
export const HBCU_COLLECTIONS_RIGHTS: RightsPolicy = {
  defaultStatus: 'unknown',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: ['full_text_republication', 'commercial_reuse', 'biometric_extraction'],
};

/**
 * Keys that must never persist from HBCU collection harvests. Bulk text/bytes are out of
 * scope, and residence-level identifiers violate the living-address constitution rule.
 */
export const HBCU_COLLECTIONS_FORBIDDEN_PAYLOAD_KEYS = [
  'fullText',
  'ocrText',
  'containerListText',
  'scopeAndContentFull',
  'pdfBytes',
  'binaryBlob',
  'attachments',
  'streetAddress',
  'residentialAddress',
] as const;

/** How a seeded HBCU collection is reachable for discovery. */
export type HbcuDiscoveryLane = 'dpla-hub' | 'ead-finding-aid';

// ---------------------------------------------------------------------------
// HbcuCollectionSource contract (a registered HBCU special collection)
// ---------------------------------------------------------------------------

/**
 * A registered HBCU special collection: one institution's archive/research center reachable
 * either through a DPLA hub (contributor-matched in the campaign's DPLA lane) or through a
 * standalone EAD finding-aid portal. Seeds live in `fixtures/hbcu-collections.v1.json`.
 */
export type HbcuCollectionSource = {
  /** Short stable slug, e.g. `howard-msrc`. */
  readonly id: string;
  /** Registry entry id, e.g. `reg_hbcu_howard_msrc`. */
  readonly registryEntryId: string;
  /** Evidence-source id, e.g. `src_hbcu_howard_msrc`. */
  readonly sourceId: string;
  readonly organizationId: string;
  /** Institution slug, e.g. `howard`, `fisk`, `tuskegee`, `hampton`. */
  readonly institution: string;
  readonly displayName: string;
  /** Primary jurisdiction as an ISO-3166-2 code, e.g. `US-DC`. */
  readonly state: string;
  /** Public special-collections portal URL (verified, never fabricated). */
  readonly collectionUrl: string;
  /** Public EAD finding-aid base URL when the institution exposes one. */
  readonly findingAidBaseUrl?: string;
  readonly lane: HbcuDiscoveryLane;
  /**
   * Contributor/provider display-name fragment used to prioritize this institution's records
   * inside DPLA hub responses (matcher string, not a URL). Only for `dpla-hub` lane seeds.
   */
  readonly dplaContributorMatch?: string;
  /** Research-kernel source class; always `scholarly` for this methodology. */
  readonly sourceClass?: typeof HBCU_COLLECTIONS_SOURCE_CLASS;
  /** Constitution provenance classification override (defaults to `primary_archival`). */
  readonly classification?: string;
  readonly notes?: string;
};

/** A finding aid exposed by an HBCU collection, returned by `HbcuAdapter.listFindingAids`. */
export type HbcuFindingAid = {
  /** Institution slug this finding aid belongs to (matches `HbcuCollectionSource.institution`). */
  readonly institution: string;
  readonly findingAidId: string;
  readonly title: string;
  readonly repository: string;
  readonly state: string;
  /** Canonical finding-aid URL (EAD/XML or HTML) for this collection. */
  readonly findingAidUrl: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
};

/**
 * A discovery candidate extracted from a finding aid or collection description.
 * Snippet-only: `summary` is a short scope-and-content abstract, never a full container list.
 */
export type HbcuCandidateInput = {
  readonly stableIdentifier?: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly repository: string;
  readonly institution: string;
  readonly findingAidId: string;
  readonly state: string;
  readonly summary?: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
  /** EAD component id or finding-aid unitid. */
  readonly eadComponentId?: string;
  readonly classification?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
};

export type HbcuCandidatePayload = {
  readonly schemaVersion: typeof HBCU_COLLECTIONS_PAYLOAD_SCHEMA_VERSION;
  readonly repository: string;
  readonly institution: string;
  readonly findingAidId: string;
  readonly state: string;
  readonly summary?: string;
  readonly creator?: string;
  readonly coveragePeriod?: string;
  readonly eadComponentId?: string;
  readonly identifiers?: Readonly<Record<string, string>>;
};

export type HbcuCandidateRecord = AdapterCandidateRecord & {
  readonly payload: HbcuCandidatePayload;
};

/**
 * Pluggable harvester interface. Deterministic/fixture implementations are injected in tests;
 * a live implementation MUST use `@repo/security` safe-fetch for every EAD/portal request and
 * MUST NOT be constructed from raw `fetch`.
 */
export interface HbcuAdapter {
  readonly adapterId: string;
  /** List finding aids an HBCU institution exposes (institution slug, e.g. `howard`). */
  listFindingAids(
    institution: string,
  ): Promise<readonly HbcuFindingAid[]> | readonly HbcuFindingAid[];
  /** Extract candidate component descriptions from a single finding aid. */
  extractCandidates(
    findingAid: HbcuFindingAid,
  ): Promise<readonly HbcuCandidateInput[]> | readonly HbcuCandidateInput[];
}

// ---------------------------------------------------------------------------
// Contract + evidence source construction
// ---------------------------------------------------------------------------

const HBCU_PERMITTED_CLAIM_CLASSES = [
  'institutional_fact',
  'biographical_fact',
  'geographic_fact',
] as const;

export function createHbcuCollectionsAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: HBCU_COLLECTIONS_ADAPTER_ID,
    parserVersion: HBCU_COLLECTIONS_PARSER_VERSION,
    displayName: 'HBCU Special Collections (finding aids + local repositories)',
    classification: HBCU_COLLECTIONS_DEFAULT_CLASSIFICATION,
    stableIdScheme: HBCU_COLLECTIONS_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: HBCU_COLLECTIONS_RIGHTS,
      permittedClaimClasses: [...HBCU_PERMITTED_CLAIM_CLASSES],
      refreshSchedule: '0 6 1 * *',
      notes:
        'HBCU Special Collections Discovery harvest. Research-kernel sourceClass=scholarly ' +
        '(strong for historical-synthesis). Metadata + canonical finding-aid/collection URLs + ' +
        'capped scope-and-content snippets only — never bulk OCR, container lists, or item ' +
        'bytes. Fixtures-first; do not enable without explicit policy approval and a ' +
        'safe-fetch-backed live adapter.',
    },
    rights: HBCU_COLLECTIONS_RIGHTS,
    permittedClaimClasses: [...HBCU_PERMITTED_CLAIM_CLASSES],
    refreshSchedule: '0 6 1 * *',
    rateLimits: { requestsPerMinute: 6, burst: 2 },
    volume: { expectedRecordsPerRun: 60, countToleranceFraction: 0.5 },
    geographicCoverage: {
      countries: ['US'],
      notes: 'HBCU special collections and university archives (EAD/local repositories).',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.1,
    ...overrides,
  };
}

export function createHbcuCollectionEvidenceSource(
  source: HbcuCollectionSource,
  now: string,
): EvidenceSource {
  return {
    id: source.sourceId,
    organizationId: source.organizationId,
    displayName: source.displayName,
    classification: source.classification ?? HBCU_COLLECTIONS_DEFAULT_CLASSIFICATION,
    adapterId: HBCU_COLLECTIONS_ADAPTER_ID,
    stableIdScheme: HBCU_COLLECTIONS_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: HBCU_COLLECTIONS_RIGHTS,
      permittedClaimClasses: [...HBCU_PERMITTED_CLAIM_CLASSES],
      refreshSchedule: '0 6 1 * *',
      notes:
        `HBCU special-collections source for ${source.displayName} (${source.state}); ` +
        'research-kernel sourceClass=scholarly; metadata + pointers only; fixtures-first; ' +
        'disabled until approval.',
    },
    adapterEnabled: true,
    killSwitchId: HBCU_COLLECTIONS_KILL_SWITCH_ID,
    createdAt: now,
    updatedAt: now,
  };
}

export type RegisterHbcuCollectionSourceInput = {
  readonly store: SourceRegistryStore;
  readonly source: HbcuCollectionSource;
  readonly createdAt: string;
  readonly contractOverrides?: Partial<SourceAdapterContract>;
};

/**
 * Registers one HBCU collection source in `disabled` state. Wraps `registerSource` with
 * research-kernel sourceClass=scholarly (fitness `strong` for historical-synthesis). Does NOT
 * approve policy — approval is a separate, human/campaign-time step (`approveSourcePolicy`).
 */
export function registerHbcuCollectionSource(
  input: RegisterHbcuCollectionSourceInput,
): SourceRegistryEntry {
  const contract = createHbcuCollectionsAdapterContract(input.contractOverrides);
  const evidenceSource = createHbcuCollectionEvidenceSource(input.source, input.createdAt);
  return registerSource(input.store, {
    id: input.source.registryEntryId,
    contract,
    evidenceSource,
    registryState: 'disabled',
    createdAt: input.createdAt,
  });
}

// ---------------------------------------------------------------------------
// Seed fixture parsing
// ---------------------------------------------------------------------------

/**
 * Validates `fixtures/hbcu-collections.v1.json` (or an equivalent injected seed document)
 * into typed `HbcuCollectionSource[]`. Throws on any malformed seed — a bad URL or missing
 * field must never silently become a registered source.
 */
export function parseHbcuCollectionSeeds(raw: unknown): readonly HbcuCollectionSource[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('HBCU collection seed document must be an object');
  }
  const doc = raw as Record<string, unknown>;
  if (doc.schemaVersion !== HBCU_COLLECTIONS_SEED_SCHEMA_VERSION) {
    throw new Error(
      `HBCU collection seed schemaVersion must be ${HBCU_COLLECTIONS_SEED_SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(doc.sources)) {
    throw new Error('HBCU collection seed document requires a sources array');
  }
  return doc.sources.map((entry, index) => parseSeedEntry(entry, index));
}

function requireString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`HBCU collection seed [${index}] requires string field "${field}"`);
  }
  return value.trim();
}

function parseSeedEntry(entry: unknown, index: number): HbcuCollectionSource {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`HBCU collection seed [${index}] must be an object`);
  }
  const record = entry as Record<string, unknown>;
  const lane = requireString(record.lane, 'lane', index);
  if (lane !== 'dpla-hub' && lane !== 'ead-finding-aid') {
    throw new Error(`HBCU collection seed [${index}] lane must be dpla-hub or ead-finding-aid`);
  }
  const collectionUrl = requireString(record.collectionUrl, 'collectionUrl', index);
  new URL(collectionUrl); // throws on invalid
  const findingAidBaseUrl =
    typeof record.findingAidBaseUrl === 'string' && record.findingAidBaseUrl.trim()
      ? record.findingAidBaseUrl.trim()
      : undefined;
  if (findingAidBaseUrl) new URL(findingAidBaseUrl);

  return {
    id: requireString(record.id, 'id', index),
    registryEntryId: requireString(record.registryEntryId, 'registryEntryId', index),
    sourceId: requireString(record.sourceId, 'sourceId', index),
    organizationId: requireString(record.organizationId, 'organizationId', index),
    institution: requireString(record.institution, 'institution', index),
    displayName: requireString(record.displayName, 'displayName', index),
    state: requireString(record.state, 'state', index),
    collectionUrl,
    ...(findingAidBaseUrl !== undefined ? { findingAidBaseUrl } : {}),
    lane,
    ...(typeof record.dplaContributorMatch === 'string' && record.dplaContributorMatch.trim()
      ? { dplaContributorMatch: record.dplaContributorMatch.trim() }
      : {}),
    sourceClass: HBCU_COLLECTIONS_SOURCE_CLASS,
    ...(typeof record.classification === 'string' && record.classification.trim()
      ? { classification: record.classification.trim() }
      : {}),
    ...(typeof record.notes === 'string' && record.notes.trim()
      ? { notes: record.notes.trim() }
      : {}),
  };
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

function buildStableIdentifier(input: HbcuCandidateInput): string {
  const explicit = input.stableIdentifier?.trim();
  if (explicit) return explicit;
  const component = input.eadComponentId?.trim();
  if (component) return `hbcu:${input.institution}:${input.findingAidId}:${component}`;
  return `hbcu:${input.institution}:${input.findingAidId}:${input.canonicalUrl}`;
}

function stripForbiddenIdentifiers(
  identifiers: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!identifiers) return undefined;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(identifiers)) {
    if ((HBCU_COLLECTIONS_FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value === 'string' && value.trim()) cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Normalize a single HBCU candidate input into a provenance-stamped candidate record. */
export function normalizeHbcuCandidate(input: {
  readonly candidate: HbcuCandidateInput;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): HbcuCandidateRecord {
  const { candidate } = input;
  const title = candidate.title?.trim();
  if (!title) {
    throw new Error('HBCU collection candidate requires a title');
  }
  const canonicalUrl = candidate.canonicalUrl?.trim();
  if (!canonicalUrl) {
    throw new Error('HBCU collection candidate requires a canonicalUrl');
  }
  new URL(canonicalUrl); // throws on invalid

  const payload: HbcuCandidatePayload = {
    schemaVersion: HBCU_COLLECTIONS_PAYLOAD_SCHEMA_VERSION,
    repository: candidate.repository,
    institution: candidate.institution,
    findingAidId: candidate.findingAidId,
    state: candidate.state,
    ...(candidate.summary !== undefined ? { summary: capSnippet(candidate.summary) } : {}),
    ...(candidate.creator !== undefined ? { creator: candidate.creator } : {}),
    ...(candidate.coveragePeriod !== undefined ? { coveragePeriod: candidate.coveragePeriod } : {}),
    ...(candidate.eadComponentId !== undefined ? { eadComponentId: candidate.eadComponentId } : {}),
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
      HBCU_COLLECTIONS_DEFAULT_CLASSIFICATION,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  return stamped as HbcuCandidateRecord;
}

/** Normalize a batch of HBCU candidate inputs under one registry entry/run. */
export function normalizeHbcuBatch(input: {
  readonly candidates: readonly HbcuCandidateInput[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): readonly HbcuCandidateRecord[] {
  return input.candidates.map((candidate) =>
    normalizeHbcuCandidate({
      candidate,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
    }),
  );
}

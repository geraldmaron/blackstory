/**
 * Oral-history source adapter public surface for the Oral History Pipeline
 * research-discovery methodology.
 *
 * Oral history collections — LOC American Folklife Center / Civil Rights History Project,
 * StoryCorps, the UNC Southern Oral History Program, Duke's Behind the Veil, and HBCU
 * collections — are the richest source of nooks-and-crannies personal/local Black-history
 * stories: church mothers, midwives, union stewards, corner-store owners, freedom-school
 * teachers who appear in no national database. This adapter normalizes *interview metadata,
 * canonical interview URLs, and person/place/event mention snippets* into private discovery
 * candidates.
 *
 * Invariants (ADR-009 + constitution):
 * - Self-contained module. Does NOT edit any barrel; parent wires the export lines from the doc.
 * - Registers DISABLED. `assertAdapterMayRun` / `approveSourcePolicy` gate any real run.
 * - Mention snippets + interview pointers only — never full transcripts, audio, or media bytes.
 * - Dignity: no trauma hooks/spectacle in stored snippets; residential-address precision is
 *   withheld from stored text; unknown living status is treated as living.
 * - Discovery produces private candidates only; never a publish path.
 * - Live harvesting MUST use @repo/security safe-fetch (see OralHistoryAdapter contract note);
 *   this module ships fixture-first and injects the adapter, so it performs no network I/O
 *   itself.
 *
 * Research-kernel alignment: oral testimony is the `first-person-or-oral-history` source class
 * (see `packages/research-kernel/profiles/black-history.v1.json` → sourceFitness), fitness
 * `strong` for `lived-experience-or-local-memory` claims — with the kernel's own limitation that
 * identity, chronology, coordination, and copying require review. The provenance-layer
 * `EvidenceSource.classification` is a constitution classification; first-person testimony maps
 * to `community_oral`, which is deliberately a LOW-AUTHORITY tier: oral-history mentions can
 * inform research, boost obscurity discovery, and seed authority-harvest follow-ups, but can
 * never publish alone.
 */
import { hashUtf8 } from '../../provenance/hashes.js';
import type { EvidenceSource } from '../../provenance/source.js';
import type { RightsPolicy } from '../../provenance/rights.js';
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../../rights/evidence-pointer.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION, stampCandidateProvenance } from '../candidates.js';
import { registerSource, type SourceRegistryStore } from '../registry.js';
import type {
  AdapterCandidateRecord,
  SourceAdapterContract,
  SourceRegistryEntry,
} from '../types.js';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const ORAL_HISTORY_ADAPTER_ID = 'oral-history-v1' as const;
export const ORAL_HISTORY_PARSER_VERSION = 'oral-history-parser-1.0.0' as const;
export const ORAL_HISTORY_STABLE_ID_SCHEME = 'oral-history-interview-mention' as const;
export const ORAL_HISTORY_PAYLOAD_SCHEMA_VERSION = 'oral-history-payload.v1' as const;

/**
 * Research-kernel source class for oral testimony. Distinct from the constitution's
 * provenance classification below.
 */
export const ORAL_HISTORY_SOURCE_CLASS = 'first-person-or-oral-history' as const;

/**
 * Constitution provenance classification for first-person oral testimony. `community_oral` is a
 * low-authority tier by design: it feeds the obscurity low-authority boost and enables
 * authority-harvest of primary-source links cited in transcripts, and it can never publish alone.
 */
export const ORAL_HISTORY_DEFAULT_CLASSIFICATION = 'community_oral' as const;

export const ORAL_HISTORY_KILL_SWITCH_ID = 'adapter:oral_history' as const;

/**
 * Interview rights vary per collection (LOC public-domain-ish releases, StoryCorps licenses,
 * university deeds of gift). Store pointers + capped mention snippets only; rights are resolved
 * per-item downstream, never assumed at discovery time.
 */
export const ORAL_HISTORY_RIGHTS: RightsPolicy = {
  defaultStatus: 'unknown',
  publicationPermissions: ['cite', 'short_excerpt'],
  prohibitedUses: [
    'full_text_republication',
    'commercial_reuse',
    'biometric_extraction',
    'living_person_doxxing',
  ],
};

/** Keys that must never persist from oral-history harvests (full transcripts/media/PII). */
export const ORAL_HISTORY_FORBIDDEN_PAYLOAD_KEYS = [
  'fullTranscript',
  'transcriptText',
  'audioBytes',
  'videoBytes',
  'mediaBlob',
  'narratorContact',
  'narratorAddress',
  'streetAddress',
  'residentialAddress',
  'phone',
  'email',
] as const;

/**
 * Residential-precision pattern ("1234 Maple Street"). Living addresses are never public;
 * unknown living status is treated as living — so stored snippets withhold this precision
 * unconditionally (private candidates included, to fail closed).
 */
const RESIDENTIAL_ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Za-z][A-Za-z.'-]*\s+){0,4}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|place|pl|terrace|ter)\b\.?/gi;

/** Replace residential-address precision with a withheld marker (dignity + living-person rule). */
export function withholdResidentialPrecision(text: string): string {
  return text.replace(RESIDENTIAL_ADDRESS_RE, '[address withheld]');
}

// ---------------------------------------------------------------------------
// OralHistorySource contract (a registered oral-history archive)
// ---------------------------------------------------------------------------

export type OralHistoryLivingStatus = 'living' | 'deceased' | 'unknown';

/**
 * A collection of interviews an institution exposes (e.g. the Civil Rights History Project).
 * Seeds live in `fixtures/oral-history-collections.v1.json`.
 */
export type OralHistoryCollection = {
  readonly sourceId: string;
  /** Short stable slug, e.g. `loc-crhp`. */
  readonly collectionId: string;
  readonly title: string;
  readonly institution: string;
  /** Canonical public collection URL. */
  readonly collectionUrl: string;
  readonly coveragePeriod?: string;
  readonly notes?: string;
};

/**
 * A registered oral-history source: one institution/program whose interview collections are
 * walked by the campaign.
 */
export type OralHistorySource = {
  /** Short stable slug, e.g. `loc-crhp`. */
  readonly id: string;
  /** Registry entry id, e.g. `reg_oral_history_loc_crhp`. */
  readonly registryEntryId: string;
  /** Evidence-source id, e.g. `src_oral_history_loc_crhp`. */
  readonly sourceId: string;
  readonly organizationId: string;
  readonly displayName: string;
  readonly institution: string;
  /** Public homepage / program URL. */
  readonly homepageUrl: string;
  /** Collections this source exposes for the campaign to walk. */
  readonly collections: readonly OralHistoryCollection[];
  /** Research-kernel source class; always `first-person-or-oral-history` for this methodology. */
  readonly sourceClass?: typeof ORAL_HISTORY_SOURCE_CLASS;
  /** Constitution provenance classification override (defaults to `community_oral`). */
  readonly classification?: string;
  readonly notes?: string;
};

// ---------------------------------------------------------------------------
// Interviews, transcripts, and mentions
// ---------------------------------------------------------------------------

/** Interview metadata returned by `OralHistoryAdapter.listInterviews`. */
export type OralHistoryInterview = {
  readonly collectionId: string;
  /** Institution-stable interview id (LOC item id, SOHP interview number, …). */
  readonly interviewId: string;
  readonly title: string;
  /** Canonical public interview / finding-aid URL. */
  readonly interviewUrl: string;
  /** Narrator name as published by the archive itself (never independently outed). */
  readonly narratorName?: string;
  readonly interviewDate?: string;
  /** Short archive-provided abstract (capped at normalization). */
  readonly summary?: string;
  /**
   * EPHEMERAL transcript or index prose held in memory for mention extraction and cited-URL
   * hints only. NEVER persisted on a candidate (see ORAL_HISTORY_FORBIDDEN_PAYLOAD_KEYS).
   */
  readonly transcriptText?: string;
  /** Archive-stated status only; absent means unknown, and unknown is treated as living. */
  readonly narratorLivingStatus?: OralHistoryLivingStatus;
};

/**
 * Ephemeral transcript wrapper passed to `extractMentions`. `text` is transcript or summary
 * prose held in memory for extraction only — it is NEVER persisted on a candidate.
 */
export type OralHistoryTranscript = {
  readonly interview: OralHistoryInterview;
  readonly text: string;
};

export const ORAL_HISTORY_MENTION_KINDS = ['person', 'place', 'event'] as const;

export type OralHistoryMentionKind = (typeof ORAL_HISTORY_MENTION_KINDS)[number];

/**
 * A person/place/event mention extracted from a transcript, returned by
 * `OralHistoryAdapter.extractMentions`. Snippet-only: `contextSnippet` is a short quote or
 * paraphrase for research triage, never a trauma hook and never a transcript dump.
 */
export type OralHistoryMention = {
  readonly kind: OralHistoryMentionKind;
  /** Display name of the mentioned person/place/event. */
  readonly name: string;
  /** Short context snippet (capped at normalization). */
  readonly contextSnippet?: string;
  /** Coarse place hint (city/county/state — residential precision is withheld). */
  readonly placeHint?: string;
  /** Time period hint, e.g. `1955/1968` or `1963`. */
  readonly timePeriod?: string;
  /**
   * Optional identifiers keyed by namespace (wikidata, loc, viaf, …). Most oral-history
   * subjects have NONE — which is the point: identifier sparseness boosts their obscurity.
   */
  readonly identifiers?: Readonly<Record<string, string>>;
  /** Archive-stated status only; absent means unknown, and unknown is treated as living. */
  readonly livingStatus?: OralHistoryLivingStatus;
  /** Outbound primary-source URLs cited near the mention (fed to authority harvest). */
  readonly citedUrls?: readonly string[];
  readonly stableIdentifier?: string;
};

/**
 * Pluggable harvester interface. Deterministic/fixture implementations are injected in tests;
 * a live implementation MUST use `@repo/security` safe-fetch for every request and MUST NOT be
 * constructed from raw `fetch`.
 */
export interface OralHistoryAdapter {
  readonly adapterId: string;
  /** List interviews (metadata + optional ephemeral transcript access) for a collection. */
  listInterviews(
    collection: OralHistoryCollection,
  ): Promise<readonly OralHistoryInterview[]> | readonly OralHistoryInterview[];
  /** Extract person/place/event mentions from one interview's ephemeral transcript text. */
  extractMentions(
    transcript: OralHistoryTranscript,
  ): Promise<readonly OralHistoryMention[]> | readonly OralHistoryMention[];
}

// ---------------------------------------------------------------------------
// Contract + evidence source construction
// ---------------------------------------------------------------------------

export function createOralHistoryAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: ORAL_HISTORY_ADAPTER_ID,
    parserVersion: ORAL_HISTORY_PARSER_VERSION,
    displayName: 'Oral History Collections (LOC AFC / StoryCorps / SOHP / HBCU)',
    classification: ORAL_HISTORY_DEFAULT_CLASSIFICATION,
    stableIdScheme: ORAL_HISTORY_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: ORAL_HISTORY_RIGHTS,
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 6 1 * *',
      notes:
        'Oral History Pipeline harvest. Research-kernel sourceClass=first-person-or-oral-history ' +
        '(fitness strong for lived-experience-or-local-memory; identity/chronology require ' +
        'review). Interview metadata + canonical URLs + capped mention snippets only — never ' +
        'full transcripts, audio, or narrator PII. Fixtures-first; do not enable without ' +
        'explicit policy approval and a safe-fetch-backed live adapter.',
    },
    rights: ORAL_HISTORY_RIGHTS,
    permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
    refreshSchedule: '0 6 1 * *',
    rateLimits: { requestsPerMinute: 6, burst: 2 },
    volume: { expectedRecordsPerRun: 60, countToleranceFraction: 0.5 },
    geographicCoverage: {
      countries: ['US'],
      notes: 'U.S. oral-history collections (LOC AFC/CRHP, StoryCorps, UNC SOHP, HBCU archives).',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.1,
    ...overrides,
  };
}

export function createOralHistoryEvidenceSource(
  source: OralHistorySource,
  now: string,
): EvidenceSource {
  return {
    id: source.sourceId,
    organizationId: source.organizationId,
    displayName: source.displayName,
    classification: source.classification ?? ORAL_HISTORY_DEFAULT_CLASSIFICATION,
    adapterId: ORAL_HISTORY_ADAPTER_ID,
    stableIdScheme: ORAL_HISTORY_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: ORAL_HISTORY_RIGHTS,
      permittedClaimClasses: ['biographical_fact', 'geographic_fact', 'organizational_fact'],
      refreshSchedule: '0 6 1 * *',
      notes:
        `Oral-history source for ${source.displayName} (${source.institution}); research-kernel ` +
        'sourceClass=first-person-or-oral-history; mention snippets + pointers only; ' +
        'fixtures-first; disabled until approval.',
    },
    adapterEnabled: true,
    killSwitchId: ORAL_HISTORY_KILL_SWITCH_ID,
    createdAt: now,
    updatedAt: now,
  };
}

export type RegisterOralHistorySourceInput = {
  readonly store: SourceRegistryStore;
  readonly source: OralHistorySource;
  readonly createdAt: string;
  readonly contractOverrides?: Partial<SourceAdapterContract>;
};

/**
 * Registers one oral-history source in `disabled` state. Wraps `registerSource` with
 * research-kernel sourceClass=first-person-or-oral-history mapped onto the constitution
 * classification `community_oral`. Does NOT approve policy — approval is a separate,
 * human/campaign-time step (`approveSourcePolicy`).
 */
export function registerOralHistorySource(
  input: RegisterOralHistorySourceInput,
): SourceRegistryEntry {
  const contract = createOralHistoryAdapterContract(input.contractOverrides);
  const evidenceSource = createOralHistoryEvidenceSource(input.source, input.createdAt);
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

export type OralHistoryCandidatePayload = {
  readonly schemaVersion: typeof ORAL_HISTORY_PAYLOAD_SCHEMA_VERSION;
  readonly collectionId: string;
  readonly interviewId: string;
  readonly interviewUrl: string;
  readonly institution: string;
  readonly mentionKind: OralHistoryMentionKind;
  readonly narratorName?: string;
  readonly summary?: string;
  readonly placeHint?: string;
  readonly timePeriod?: string;
  readonly livingStatus: OralHistoryLivingStatus;
  /** Unknown living = living. Drives downstream privacy handling; never publicizes anyone. */
  readonly treatAsLiving: boolean;
  readonly identifiers?: Readonly<Record<string, string>>;
  /** Outbound cited URLs — consumed by authority harvest for primary-source follow-ups. */
  readonly outboundLinkHints?: readonly string[];
};

export type OralHistoryCandidateRecord = AdapterCandidateRecord & {
  readonly payload: OralHistoryCandidatePayload;
};

function capSnippet(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  const byWords = collapsed.split(' ').slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ');
  return byWords.length > MAX_EVIDENCE_SNIPPET_CHARACTERS
    ? byWords.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS).trimEnd()
    : byWords;
}

function buildStableIdentifier(
  interview: OralHistoryInterview,
  mention: OralHistoryMention,
): string {
  const explicit = mention.stableIdentifier?.trim();
  if (explicit) return explicit;
  const digest = hashUtf8(`${mention.kind}:${mention.name.trim().toLowerCase()}`).digest.slice(
    0,
    24,
  );
  return `oral-history:${interview.collectionId}:${interview.interviewId}:${digest}`;
}

function stripForbiddenIdentifiers(
  identifiers: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!identifiers) return undefined;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(identifiers)) {
    if ((ORAL_HISTORY_FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value === 'string' && value.trim()) cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

const BARE_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const MAX_LINK_HINTS = 40;

/** Extract cited URLs from ephemeral transcript text for authority harvest (never persisted prose). */
export function extractCitedUrlHints(text: string): readonly string[] {
  const found: string[] = [];
  for (const match of text.matchAll(BARE_URL_RE)) {
    found.push(match[0].replace(/[.,;:]+$/u, ''));
    if (found.length >= MAX_LINK_HINTS) break;
  }
  return found;
}

export type NormalizeOralHistoryMentionInput = {
  readonly mention: OralHistoryMention;
  readonly interview: OralHistoryInterview;
  readonly collection: OralHistoryCollection;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  /** Extra cited-URL hints (e.g. extracted from the ephemeral transcript). */
  readonly extraLinkHints?: readonly string[];
};

/**
 * Normalize a single transcript mention into a provenance-stamped candidate record.
 * Snippets are capped, residential precision is withheld, forbidden keys are stripped, and
 * unknown living status is treated as living.
 */
export function normalizeOralHistoryMention(
  input: NormalizeOralHistoryMentionInput,
): OralHistoryCandidateRecord {
  const { mention, interview, collection } = input;
  const name = mention.name?.trim();
  if (!name) {
    throw new Error('Oral-history mention requires a name');
  }
  if (!(ORAL_HISTORY_MENTION_KINDS as readonly string[]).includes(mention.kind)) {
    throw new Error(`Unknown oral-history mention kind: ${String(mention.kind)}`);
  }
  new URL(interview.interviewUrl); // throws on invalid

  const livingStatus: OralHistoryLivingStatus = mention.livingStatus ?? 'unknown';
  const treatAsLiving = mention.kind === 'person' && livingStatus !== 'deceased';

  const snippet = mention.contextSnippet
    ? withholdResidentialPrecision(capSnippet(mention.contextSnippet))
    : undefined;
  const placeHint = mention.placeHint
    ? withholdResidentialPrecision(mention.placeHint.trim())
    : undefined;

  const linkHints = [
    ...(mention.citedUrls ?? []),
    ...(input.extraLinkHints ?? []),
  ].slice(0, MAX_LINK_HINTS);

  const identifiers = stripForbiddenIdentifiers(mention.identifiers);

  const payload: OralHistoryCandidatePayload = {
    schemaVersion: ORAL_HISTORY_PAYLOAD_SCHEMA_VERSION,
    collectionId: collection.collectionId,
    interviewId: interview.interviewId,
    interviewUrl: interview.interviewUrl,
    institution: collection.institution,
    mentionKind: mention.kind,
    ...(interview.narratorName !== undefined ? { narratorName: interview.narratorName } : {}),
    ...(snippet !== undefined ? { summary: snippet } : {}),
    ...(placeHint !== undefined ? { placeHint } : {}),
    ...(mention.timePeriod !== undefined ? { timePeriod: mention.timePeriod } : {}),
    livingStatus,
    treatAsLiving,
    ...(identifiers !== undefined ? { identifiers } : {}),
    ...(linkHints.length > 0 ? { outboundLinkHints: linkHints } : {}),
  };

  const stamped = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: buildStableIdentifier(interview, mention),
    title: withholdResidentialPrecision(name),
    canonicalUrl: interview.interviewUrl,
    classification:
      input.registryEntry.evidenceSource.classification ?? ORAL_HISTORY_DEFAULT_CLASSIFICATION,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  return stamped as OralHistoryCandidateRecord;
}

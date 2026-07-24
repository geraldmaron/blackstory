/**
 * Cross-Reference Entity Resolution — the "Multi-Source Stitcher".
 *
 * Extends the citation-independence principle (near-duplicate cosine ≥ 0.92 between
 * excerpts, see `./review-signal.ts`) from the *citation* level down to the *entity*
 * level. Instead of asking "do two citations share upstream prose?", it asks "does the
 * same person/place appear in two or more otherwise-independent source datasets while
 * still being absent from the catalog?". Such cross-source co-appearance is itself a
 * unit of corroboration: it aggregates independent source references onto a single
 * private discovery candidate so a reviewer can decide whether the accumulated evidence
 * clears the confidence floor (repo-w4bk: 521 single-source records stuck at 0.72).
 *
 * INVARIANTS (ADR-009):
 * - PURE + read-only. Produces **private** `DiscoveryCandidateRecord`s only — never a
 *   public projection, release row, or canonical entity. Corroboration raises a
 *   candidate's review-readiness; it never auto-promotes and never publishes.
 * - Deterministic: output is independent of dataset / mention ordering.
 * - Reuses the discovery `mergeDuplicateCandidates` provenance-accumulation pattern so
 *   both source references land on one survivor without losing lineage.
 *
 * Persistence is a caller concern. Confirmed cross-source stitches map onto the existing
 * `bb_canonical.entity_merges` + `entity_merge_absorbed` ledger after human review — this
 * module introduces **no new tables and needs no migration**
 * (see `docs/research/cross-reference-stitcher.md`).
 */
import { hashUtf8, type ContentHash } from '../provenance/hashes.js';
import { mergeDuplicateCandidates } from '../discovery/deduplication.js';
import { candidateIdentityKey } from '../discovery/identity.js';
import { DISCOVERY_CANDIDATE_SCHEMA_VERSION } from '../discovery/types.js';
import type {
  DiscoveryCandidateRecord,
  DiscoverySignal,
  SourceReference,
} from '../discovery/types.js';
import type {
  AdapterCandidateProvenance,
  AdapterCandidateRecord,
} from '../adapters/types.js';

export const CROSS_REFERENCE_STITCHER_VERSION = 'cross-reference-stitcher.v1' as const;

/** A cross-source appearance only corroborates once it is seen in at least this many sources. */
export const CROSS_REFERENCE_MIN_SOURCES = 2 as const;

/** Classification stamped on synthesized cross-reference candidates. */
export const CROSS_REFERENCE_CLASSIFICATION = 'cross_reference_entity' as const;

/** Adapter schema version stamped on synthesized provenance (private candidates only). */
const CROSS_REFERENCE_ADAPTER_SCHEMA_VERSION = 'adapter-candidate.v1' as const;

/** Honorifics dropped from the head of a name during normalization. */
const HONORIFIC_PREFIXES = new Set([
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'prof',
  'professor',
  'rev',
  'reverend',
  'sir',
  'sister',
  'father',
  'capt',
  'captain',
  'sgt',
  'gen',
  'hon',
]);

/** Generational suffixes dropped from the tail of a name during normalization. */
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/** A single raw person mention inside one source dataset. */
export type PersonMentionInput = {
  /** Stable identifier for this mention within its source (e.g. row id, offset). */
  readonly mentionId: string;
  /** Raw person name as it appears in the source. */
  readonly name: string;
};

/** One source dataset: provenance metadata plus the person mentions it contains. */
export type SourceDataset = {
  readonly sourceId: string;
  readonly adapterId: string;
  readonly parserVersion: string;
  readonly registryEntryId: string;
  readonly runId: string;
  readonly capturedAt: string;
  readonly mentions: readonly PersonMentionInput[];
};

/** A normalized person mention with a resolved source reference for provenance. */
export type NormalizedPersonMention = {
  /** Normalized comparison key (diacritic-folded, lowercased, honorifics stripped). */
  readonly personKey: string;
  /** Cleaned display form (whitespace collapsed, original casing preserved). */
  readonly displayName: string;
  readonly sourceId: string;
  readonly mentionId: string;
  readonly sourceReference: SourceReference;
};

/** Result of `extractPersonMentions` for a single dataset. */
export type ExtractedPersonMentions = {
  readonly sourceId: string;
  readonly mentions: readonly NormalizedPersonMention[];
};

/** Probe passed to a caller-supplied catalog check. */
export type CatalogPersonProbe = {
  readonly personKey: string;
  readonly displayName: string;
};

/**
 * Caller-supplied catalog membership check. Return `true` when the person is ALREADY in
 * the catalog (and must therefore be excluded from cross-reference corroboration).
 * Kept as an injected function so this module never queries a live catalog itself.
 */
export type CatalogCheckFn = (probe: CatalogPersonProbe) => boolean;

/** A person appearing in ≥ CROSS_REFERENCE_MIN_SOURCES sources but not in the catalog. */
export type CrossSourceMatch = {
  readonly personKey: string;
  readonly displayName: string;
  /** Distinct source ids, sorted. Length ≥ CROSS_REFERENCE_MIN_SOURCES. */
  readonly sourceIds: readonly string[];
  readonly sourceCount: number;
  /** Every contributing mention, sorted deterministically. */
  readonly mentions: readonly NormalizedPersonMention[];
};

/**
 * Normalize a raw person name into a comparison key: Unicode NFKD, diacritics folded,
 * punctuation reduced to spaces, lowercased, honorific prefixes and generational
 * suffixes dropped, whitespace collapsed. Returns `''` when nothing usable remains.
 * Pure and deterministic.
 */
export function normalizePersonName(name: string): string {
  const folded = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation -> space
    .toLowerCase();

  const tokens = folded.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && HONORIFIC_PREFIXES.has(tokens[0]!)) {
    tokens.shift();
  }
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(' ');
}

/** Cleaned display form: whitespace collapsed, original casing preserved. */
function cleanDisplayName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function buildSourceReferenceForMention(
  dataset: SourceDataset,
  mention: PersonMentionInput,
  stableIdentifier: string,
): SourceReference {
  return {
    sourceId: dataset.sourceId,
    adapterId: dataset.adapterId,
    parserVersion: dataset.parserVersion,
    registryEntryId: dataset.registryEntryId,
    runId: dataset.runId,
    capturedAt: dataset.capturedAt,
    sourceItemId: mention.mentionId,
    stableIdentifier,
  };
}

function crossReferenceStableIdentifier(personKey: string): string {
  return `cross-reference-person:${personKey}`;
}

function crossReferenceContentHash(personKey: string): ContentHash {
  // Same person -> identical hash -> mergeDuplicateCandidates aggregates their source
  // references. Distinct persons -> distinct hash -> never cross-merge.
  return hashUtf8(`${CROSS_REFERENCE_STITCHER_VERSION}::person::${personKey}`);
}

/**
 * PURE. Normalize every person mention in one dataset into stable comparison tokens with
 * a resolved source reference. Mentions whose name normalizes to empty are dropped.
 * Output mentions are sorted by `mentionId` for determinism.
 */
export function extractPersonMentions(dataset: SourceDataset): ExtractedPersonMentions {
  const mentions: NormalizedPersonMention[] = [];

  for (const mention of dataset.mentions) {
    const personKey = normalizePersonName(mention.name);
    if (personKey === '') {
      continue;
    }
    const stableIdentifier = crossReferenceStableIdentifier(personKey);
    mentions.push({
      personKey,
      displayName: cleanDisplayName(mention.name),
      sourceId: dataset.sourceId,
      mentionId: mention.mentionId,
      sourceReference: buildSourceReferenceForMention(dataset, mention, stableIdentifier),
    });
  }

  mentions.sort((a, b) => a.mentionId.localeCompare(b.mentionId));
  return { sourceId: dataset.sourceId, mentions };
}

type PersonAccumulator = {
  personKey: string;
  readonly displayNameCounts: Map<string, number>;
  readonly sourceIds: Set<string>;
  readonly mentions: NormalizedPersonMention[];
};

/** Pick the most frequent display form; tie-break lexicographically for determinism. */
function resolveDisplayName(counts: ReadonlyMap<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [display, count] of counts) {
    if (count > bestCount || (count === bestCount && display.localeCompare(best) < 0)) {
      best = display;
      bestCount = count;
    }
  }
  return best;
}

/**
 * PURE. Return persons mentioned in ≥ CROSS_REFERENCE_MIN_SOURCES *distinct* source
 * datasets that the catalog check reports as NOT already cataloged. Cross-source
 * co-appearance is the corroboration signal. Output is deterministic (sorted by
 * `personKey`); mentions and source ids inside each match are sorted too.
 */
export function findCrossSourceMatches(
  datasets: readonly SourceDataset[],
  catalogCheckFn: CatalogCheckFn,
): readonly CrossSourceMatch[] {
  const byPerson = new Map<string, PersonAccumulator>();

  for (const dataset of datasets) {
    const extracted = extractPersonMentions(dataset);
    for (const mention of extracted.mentions) {
      let acc = byPerson.get(mention.personKey);
      if (!acc) {
        acc = {
          personKey: mention.personKey,
          displayNameCounts: new Map(),
          sourceIds: new Set(),
          mentions: [],
        };
        byPerson.set(mention.personKey, acc);
      }
      acc.displayNameCounts.set(
        mention.displayName,
        (acc.displayNameCounts.get(mention.displayName) ?? 0) + 1,
      );
      acc.sourceIds.add(mention.sourceId);
      acc.mentions.push(mention);
    }
  }

  const matches: CrossSourceMatch[] = [];

  for (const acc of byPerson.values()) {
    if (acc.sourceIds.size < CROSS_REFERENCE_MIN_SOURCES) {
      continue; // single-source person: no cross-source corroboration
    }
    const displayName = resolveDisplayName(acc.displayNameCounts);
    if (catalogCheckFn({ personKey: acc.personKey, displayName })) {
      continue; // already cataloged: excluded from discovery
    }

    const sortedMentions = [...acc.mentions].sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) || a.mentionId.localeCompare(b.mentionId),
    );

    matches.push({
      personKey: acc.personKey,
      displayName,
      sourceIds: [...acc.sourceIds].sort((a, b) => a.localeCompare(b)),
      sourceCount: acc.sourceIds.size,
      mentions: sortedMentions,
    });
  }

  matches.sort((a, b) => a.personKey.localeCompare(b.personKey));
  return matches;
}

function minMaxCapturedAt(
  mentions: readonly NormalizedPersonMention[],
): { readonly earliest: string; readonly latest: string } {
  let earliest = mentions[0]!.sourceReference.capturedAt;
  let latest = earliest;
  for (const mention of mentions) {
    const at = mention.sourceReference.capturedAt;
    if (at.localeCompare(earliest) < 0) earliest = at;
    if (at.localeCompare(latest) > 0) latest = at;
  }
  return { earliest, latest };
}

function crossReferenceSignal(sourceCount: number): DiscoverySignal {
  return {
    strength: 'medium',
    // Corroborated but NOT auto-promotable — a human still gates promotion (ADR-009).
    outcome: 'candidate_only',
    matchedClasses: [],
    matchedTerms: [],
    reasons: [
      `cross-source entity corroboration across ${sourceCount} independent sources`,
      'not in catalog; single-source confidence floor supplemented by cross-reference',
    ],
  };
}

function buildAdapterRecord(
  mention: NormalizedPersonMention,
  displayName: string,
  stableIdentifier: string,
): AdapterCandidateRecord {
  const provenance: AdapterCandidateProvenance = {
    sourceId: mention.sourceReference.sourceId,
    adapterId: mention.sourceReference.adapterId,
    parserVersion: mention.sourceReference.parserVersion,
    registryEntryId: mention.sourceReference.registryEntryId,
    runId: mention.sourceReference.runId,
    capturedAt: mention.sourceReference.capturedAt,
    sourceItemId: mention.mentionId,
    schemaVersion: CROSS_REFERENCE_ADAPTER_SCHEMA_VERSION,
  };
  return {
    stableIdentifier,
    title: displayName,
    classification: CROSS_REFERENCE_CLASSIFICATION,
    provenance,
  };
}

/**
 * PURE. Turn cross-source matches into **private** `DiscoveryCandidateRecord`s, one per
 * person, with every contributing source reference aggregated onto the survivor via the
 * discovery `mergeDuplicateCandidates` pattern. A survivor carries ≥ 2 source references
 * and therefore lands in status `merged` — corroborated, review-ready, never published.
 *
 * Deterministic: candidates are returned sorted by stable identifier; timestamps derive
 * from the mentions' captured-at range (no wall-clock reads).
 */
export function buildCrossReferenceCandidates(
  matches: readonly CrossSourceMatch[],
): readonly DiscoveryCandidateRecord[] {
  const candidates: DiscoveryCandidateRecord[] = [];

  for (const match of matches) {
    if (match.mentions.length === 0) {
      continue;
    }
    const stableIdentifier = crossReferenceStableIdentifier(match.personKey);
    const contentHash = crossReferenceContentHash(match.personKey);
    const identityKey = candidateIdentityKey(stableIdentifier, contentHash);
    const { earliest, latest } = minMaxCapturedAt(match.mentions);
    const signals = crossReferenceSignal(match.sourceCount);

    // One pre-merge record per mention; mergeDuplicateCandidates collapses them by
    // content hash and unions their source references onto a single survivor.
    const perMention: DiscoveryCandidateRecord[] = match.mentions.map((mention) => ({
      schemaVersion: DISCOVERY_CANDIDATE_SCHEMA_VERSION,
      id: `cross-ref:${match.personKey}:${mention.sourceId}:${mention.mentionId}`,
      identity: {
        identityKey,
        stableIdentifier,
        contentHash,
        sourceReferences: [mention.sourceReference],
      },
      adapterRecord: buildAdapterRecord(mention, match.displayName, stableIdentifier),
      status: 'pending',
      ingestMode: 'bulk',
      signals,
      geographicHints: [],
      retryCount: 0,
      createdAt: earliest,
      updatedAt: latest,
    }));

    const { survivors } = mergeDuplicateCandidates(perMention);
    for (const survivor of survivors) {
      candidates.push(survivor);
    }
  }

  candidates.sort((a, b) =>
    a.identity.stableIdentifier.localeCompare(b.identity.stableIdentifier),
  );
  return candidates;
}

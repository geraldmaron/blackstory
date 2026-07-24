/**
 * Claims-mining relationship extraction engine (repo-xez5.5).
 *
 * `entity-network-expansion.ts` (repo-xez5.4) stages relationship hypotheses discovered by
 * traversing Wikidata claims for a seed entity. This module stages hypotheses mined from a
 * *different* source: the free-text `predicate`/`object` pair already sitting on every row of
 * `bb_canonical.claims` (via `claim_versions`), which today back only 543 `entity_relationships`
 * rows across 1,383 entities — heavily skewed to `related_to`.
 *
 * Claims are semi-structured fact-tuples, not free prose and not a fixed schema: a short
 * predicate phrase ("was father of", "erected a sundown sign", "authored") plus a free-text
 * object. Mining them into typed edges is two mechanical steps, no LLM required for the pattern
 * matching itself (see docs/relationship-taxonomy.md's own recommendation to prefer deterministic
 * extraction where the pattern is mechanical):
 *
 *   1. Predicate pattern match -> candidate `RelationshipType` + which side (source/object) plays
 *      `from`/`to`.
 *   2. Named-entity mention match: does the claim's `object` text contain another canonical
 *      entity's display name or alias? If not, there is no second endpoint and no edge to
 *      propose, no matter how suggestive the predicate is.
 *
 * Every candidate is then checked against the taxonomy's guardrails before being staged:
 *
 *   - Kind-pair matrix (`docs/relationship-taxonomy.md` §2): the source/target `EntityKind` pair
 *     must be a documented fit for the proposed type, or the candidate is rejected rather than
 *     forced.
 *   - Temporal-context requirement (`docs/relationship-taxonomy.md` §1.7,
 *     `CAUSAL_HISTORICAL_RELATIONSHIP_TYPES` in `@repo/domain`): `caused`, `enabled`,
 *     `influenced`, `overturned` require an identifiable year/date in the claim text (or
 *     `claim_versions.created_at` is never treated as a substitute — publication metadata isn't
 *     historical timespan). No date found -> flagged `needs_temporal_context`, never staged as an
 *     unanchored causal edge.
 *
 * Nothing here writes to `bb_canonical.entity_relationships`. Output is always
 * `status: 'pending'` rows in `bb_research.landscape_candidates` (lane `'claims-relationship'`),
 * mirroring `stageNetworkCandidates`'s staging convention from `entity-network-expansion.ts`.
 */
import type { EntityKind, RelationshipType } from '@repo/domain';

export type ClaimEntity = {
  readonly id: string;
  readonly kind: EntityKind;
  readonly displayName: string;
  readonly aliases?: readonly string[];
};

export type ClaimRow = {
  readonly claimId: string;
  readonly entity: ClaimEntity;
  readonly predicate: string;
  readonly object: string;
};

/** Which side of the claim's own entity/object-mention pair becomes `from` in the proposed edge. */
type EdgeOrientation = 'entity_to_mention' | 'mention_to_entity';

type PredicatePattern = {
  readonly name: string;
  readonly test: RegExp;
  readonly relationshipType: RelationshipType;
  readonly orientation: EdgeOrientation;
  /**
   * When true, orientation is not fixed: it flips to `mention_to_entity` unless the claim's own
   * entity is a `person`. This matches the real catalog shape observed in
   * `bb_canonical.claim_versions` — a "founded" claim usually sits on the *founded* org/place/
   * publication entity, naming its (often non-canonical) human founder in free prose, not on a
   * person entity naming what they founded. Fixed patterns (e.g. `occurred_at`, `part_of`) don't
   * need this because their subject is unambiguous regardless of kind.
   */
  readonly personOriented?: boolean;
};

/**
 * Predicate phrase -> relationship type. Matched against the lowercased predicate text (the
 * `claim_versions.predicate` column). Real predicate values observed in the catalog are a mix of
 * short verb phrases ("was father of") and underscored fact-tags ("founded_by", "documented_site",
 * "sworn_in_on") — both forms are covered. Ordered most-specific-first so e.g. "founded_by" hits
 * `founded` before a looser fallback would.
 */
const PREDICATE_PATTERNS: readonly PredicatePattern[] = [
  { name: 'authored', test: /\bauthored\b|\bwrote\b|\bwas the author of\b|\bedited\b|\bpublished\b/, relationshipType: 'authored', orientation: 'entity_to_mention', personOriented: true },
  { name: 'founded', test: /\bfounded\b|\bco-founded\b|\bestablished\b|\borganized\b|\bfounded_by\b|\bfounded_year\b|\bfounded_in\b/, relationshipType: 'founded', orientation: 'entity_to_mention', personOriented: true },
  { name: 'employed_by', test: /\bemployed by\b|\bemployed_by\b|\bworked (for|at)\b|\bwas (a |an )?staff (writer|member) at\b|\bwas hired by\b|\bserved_as\b|\bserved as\b|\bserved in\b|\bserved_in\b|\bled\b/, relationshipType: 'employed_by', orientation: 'entity_to_mention', personOriented: true },
  { name: 'member_of', test: /\bmember of\b|\bmember_of\b|\bjoined\b|\bbelonged to\b|\bwas_part_of\b/, relationshipType: 'member_of', orientation: 'entity_to_mention', personOriented: true },
  { name: 'attended', test: /\battended\b/, relationshipType: 'attended', orientation: 'entity_to_mention', personOriented: true },
  { name: 'participated_in', test: /\bparticipated in\b|\btook part in\b|\brepresented\b/, relationshipType: 'participated_in', orientation: 'entity_to_mention', personOriented: true },
  { name: 'occurred_at', test: /\boccurred (at|in)\b|\btook place (at|in)\b|\bhappened (at|in)\b|\bheld\b|\bhosted\b|\bsite_of\b/, relationshipType: 'occurred_at', orientation: 'entity_to_mention' },
  { name: 'located_at', test: /\blocated (at|in)\b|\blocated_at\b|\bwas based (at|in)\b|\bwas situated (at|in)\b|\blocation\b|\bburied_at\b/, relationshipType: 'located_at', orientation: 'entity_to_mention' },
  { name: 'part_of', test: /\bpart of\b|\bpart_of\b|\bwas_part_of\b|\bis a neighborhood of\b|\bis a district of\b/, relationshipType: 'part_of', orientation: 'entity_to_mention' },
  { name: 'governed_by', test: /\bgoverned by\b|\bsubject to\b|\benfranchised by\b|\bwas protected by\b/, relationshipType: 'governed_by', orientation: 'entity_to_mention' },
  { name: 'overturned', test: /\boverturned\b|\bsuperseded\b|\bstruck down\b/, relationshipType: 'overturned', orientation: 'entity_to_mention' },
  { name: 'successor_of', test: /\bsuccessor of\b|\bsucceeded\b/, relationshipType: 'successor_of', orientation: 'entity_to_mention' },
  { name: 'commemorates', test: /\bcommemorates\b|\bmemorializes\b|\bdedicated to\b/, relationshipType: 'commemorates', orientation: 'entity_to_mention' },
  { name: 'depicts', test: /\bdepicts\b|\bportrays\b|\bprofiles\b/, relationshipType: 'depicts', orientation: 'entity_to_mention' },
  { name: 'influenced', test: /\binfluenced\b|\binspired\b/, relationshipType: 'influenced', orientation: 'entity_to_mention' },
  { name: 'caused', test: /\bcaused\b|\bled to\b|\bresulted_in\b|\bresulted in\b/, relationshipType: 'caused', orientation: 'entity_to_mention' },
  { name: 'enabled', test: /\benabled\b|\bmade possible\b/, relationshipType: 'enabled', orientation: 'entity_to_mention' },
  { name: 'cites', test: /\bcites\b|\breferences\b|\bdocuments\b|\bdocumented_by\b|\bdocumented_site\b/, relationshipType: 'cites', orientation: 'entity_to_mention' },
  // Reverse-oriented: "was father of X" means the *mention* (X) is the object of a family/parent
  // fact about a person, which the taxonomy has no dedicated type for; staged as `related_to`
  // only if no stronger pattern above matched (see extractCandidate's fallback).
];

export const CAUSAL_TEMPORAL_REQUIRED_TYPES: readonly RelationshipType[] = [
  'caused',
  'enabled',
  'influenced',
  'overturned',
];

/**
 * Kind-pair matrix, transcribed from docs/relationship-taxonomy.md §2. Keyed by
 * `${fromKind}|${toKind}|${type}`; a pair/type combination not present here has no documented
 * fit and is rejected rather than guessed. Symmetric pairs (e.g. person<->person `attended`
 * makes no sense) are intentionally NOT auto-mirrored — each direction is listed explicitly per
 * the doc's own from/to convention.
 */
const KIND_PAIR_MATRIX: ReadonlySet<string> = new Set<string>([
  'person|event|attended',
  'person|event|participated_in',
  'person|movement|participated_in',
  'person|movement|member_of',
  'organization|movement|member_of',
  'person|organization|founded',
  'person|organization|employed_by',
  'person|organization|member_of',
  'person|institution|founded',
  'person|institution|employed_by',
  'person|institution|member_of',
  'person|school|founded',
  'person|school|employed_by',
  'person|school|member_of',
  'person|place|located_at',
  'person|publication|authored',
  'publication|person|depicts',
  'publication|event|depicts',
  'case|person|cites',
  'person|case|cites',
  'person|law|governed_by',
  'person|law|cites',
  'event|place|occurred_at',
  'event|movement|part_of',
  'event|movement|participated_in',
  'organization|event|related_to',
  'organization|event|cites',
  'event|organization|cites',
  'case|law|overturned',
  'case|case|overturned',
  'law|case|cites',
  'case|law|cites',
  // Historical-causation edges: the taxonomy doc groups these under "historical-causation
  // edges" without a dedicated kind-pair row (its matrix table is organized around concrete
  // person/place/org pairs), so the pairs below are the narrowest, most-defensible reading of
  // §3.2's guidance (systemic policy/event -> place/movement/person consequence), not an
  // invented type. Flag for taxonomy-doc follow-up if broader pairs are needed.
  'law|place|caused',
  'law|place|enabled',
  'event|place|caused',
  'event|movement|caused',
  'event|movement|enabled',
  'event|movement|influenced',
  'person|movement|influenced',
  'law|movement|enabled',
  'organization|organization|successor_of',
  'place|place|part_of',
  'institution|place|located_at',
  'artifact|institution|located_at',
  'artifact|institution|depicts',
]);

export type EvidenceRef = { readonly claimId: string };

export type RejectionReason =
  | 'no_entity_mention'
  | 'kind_pair_not_in_matrix'
  | 'needs_temporal_context'
  | 'no_pattern_match';

export type RelationshipCandidate = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly fromKind: EntityKind;
  readonly toKind: EntityKind;
  readonly relationshipType: RelationshipType;
  readonly evidence: readonly EvidenceRef[];
  readonly temporalContext?: { readonly validFrom: string };
  readonly matchedPattern: string;
};

export type RejectedCandidate = {
  readonly claimId: string;
  readonly reason: RejectionReason;
  readonly detail: string;
};

export type ExtractionResult = {
  readonly candidates: readonly RelationshipCandidate[];
  readonly rejected: readonly RejectedCandidate[];
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** A four-digit year (1600-2099), the only temporal signal we trust from free claim text —
 * matching e.g. "(1954 decision date)" or "in 1963". Does not accept claim_versions.created_at
 * as a substitute; that is ingestion metadata, not historical timespan. */
const YEAR_RE = /\b(1[6-9]\d{2}|20\d{2})\b/;

function findYear(...texts: readonly string[]): string | undefined {
  for (const text of texts) {
    const match = text.match(YEAR_RE);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Finds another canonical entity mentioned by name/alias inside `text`. Returns the first,
 * longest-name match to avoid a short common name (e.g. "Cole") shadowing a longer one ("Cole
 * Memorial Church") that also matches. Excludes `excludeEntityId` (the claim's own subject) so a
 * claim never proposes a self-edge.
 */
export function findEntityMention(
  text: string,
  entities: readonly ClaimEntity[],
  excludeEntityId: string,
): ClaimEntity | undefined {
  const normalizedText = normalize(text);
  let best: ClaimEntity | undefined;
  let bestLen = 0;
  for (const candidate of entities) {
    if (candidate.id === excludeEntityId) continue;
    const names = [candidate.displayName, ...(candidate.aliases ?? [])];
    for (const name of names) {
      if (name.length < 4) continue; // avoid noisy short-name false positives
      const normalizedName = normalize(name);
      if (normalizedText.includes(normalizedName) && normalizedName.length > bestLen) {
        best = candidate;
        bestLen = normalizedName.length;
      }
    }
  }
  return best;
}

function kindPairKey(fromKind: EntityKind, toKind: EntityKind, type: RelationshipType): string {
  return `${fromKind}|${toKind}|${type}`;
}

export function isKindPairValid(fromKind: EntityKind, toKind: EntityKind, type: RelationshipType): boolean {
  return KIND_PAIR_MATRIX.has(kindPairKey(fromKind, toKind, type));
}

/**
 * Runs one claim through the extraction pipeline: pattern match -> mention match -> kind-pair
 * check -> temporal-context gate (causal types only). Returns either a stageable candidate or a
 * `RejectedCandidate` explaining why nothing was proposed — never both, and never a forced
 * `related_to` substitute (callers may layer their own `related_to` fallback on
 * `no_entity_mention`/`no_pattern_match` results if they want one; this function does not force
 * that decision).
 */
export function extractCandidate(
  claim: ClaimRow,
  allEntities: readonly ClaimEntity[],
): RelationshipCandidate | RejectedCandidate {
  const predicateNormalized = normalize(claim.predicate);
  const pattern = PREDICATE_PATTERNS.find((p) => p.test.test(predicateNormalized));
  if (!pattern) {
    return { claimId: claim.claimId, reason: 'no_pattern_match', detail: `predicate "${claim.predicate}" matched no known pattern` };
  }

  const mention = findEntityMention(claim.object, allEntities, claim.entity.id);
  if (!mention) {
    return {
      claimId: claim.claimId,
      reason: 'no_entity_mention',
      detail: `predicate matched ${pattern.name} but object text "${claim.object}" names no other canonical entity`,
    };
  }

  // For person-oriented predicates (founded/authored/employed_by/member_of/attended/
  // participated_in), the real direction depends on which side is actually the person: if the
  // claim's own entity isn't a person, the relationship almost always runs the other way (the
  // mentioned party is the one who founded/authored/joined/attended, and the claim's own entity
  // — an org/place/publication/event — is the object), per the catalog shape found in
  // bb_canonical.claim_versions (see module doc comment).
  const effectiveOrientation: EdgeOrientation =
    pattern.personOriented === true && claim.entity.kind !== 'person' && mention.kind === 'person'
      ? 'mention_to_entity'
      : pattern.orientation;

  const fromEntity = effectiveOrientation === 'entity_to_mention' ? claim.entity : mention;
  const toEntity = effectiveOrientation === 'entity_to_mention' ? mention : claim.entity;

  // "founded" against a publication target is the taxonomy's `authored` edge (§1.2: "`authored`
  // is a creation-attribution edge distinct from `founded` (orgs/institutions only)") — a person
  // who founded a newspaper/magazine is its author/creator, not its institutional founder in the
  // org/institution/school sense. Remap rather than reject a real, well-evidenced connection.
  const relationshipType: RelationshipType =
    pattern.relationshipType === 'founded' && fromEntity.kind === 'person' && toEntity.kind === 'publication'
      ? 'authored'
      : pattern.relationshipType;

  if (!isKindPairValid(fromEntity.kind, toEntity.kind, relationshipType)) {
    return {
      claimId: claim.claimId,
      reason: 'kind_pair_not_in_matrix',
      detail: `${fromEntity.kind} -> ${toEntity.kind} is not a documented pair for "${relationshipType}"`,
    };
  }

  let temporalContext: { readonly validFrom: string } | undefined;
  if (CAUSAL_TEMPORAL_REQUIRED_TYPES.includes(relationshipType)) {
    const year = findYear(claim.predicate, claim.object);
    if (!year) {
      return {
        claimId: claim.claimId,
        reason: 'needs_temporal_context',
        detail: `"${relationshipType}" requires a temporal context; no year found in claim text — needs human context-attachment, not proposed unanchored`,
      };
    }
    temporalContext = { validFrom: `${year}-01-01` };
  }

  return {
    fromEntityId: fromEntity.id,
    toEntityId: toEntity.id,
    fromKind: fromEntity.kind,
    toKind: toEntity.kind,
    relationshipType,
    evidence: [{ claimId: claim.claimId }],
    ...(temporalContext !== undefined ? { temporalContext } : {}),
    matchedPattern: pattern.name,
  };
}

export function extractCandidates(claims: readonly ClaimRow[], allEntities: readonly ClaimEntity[]): ExtractionResult {
  const candidates: RelationshipCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  for (const claim of claims) {
    const result = extractCandidate(claim, allEntities);
    if ('reason' in result) {
      rejected.push(result);
    } else {
      candidates.push(result);
    }
  }
  return { candidates, rejected };
}

// ---------------------------------------------------------------------------
// Staging (bb_research.landscape_candidates — lane 'claims-relationship')
// ---------------------------------------------------------------------------

export type RelationshipCandidateRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: 'claims-relationship';
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string;
  readonly canonical_url: string;
  readonly status: 'pending';
  readonly provenance: {
    readonly claim_ids: readonly string[];
    readonly matched_pattern: string;
  };
  readonly payload: {
    readonly from_entity_id: string;
    readonly to_entity_id: string;
    readonly relationship_type: RelationshipType;
    readonly valid_from?: string;
  };
  readonly discovered_at: string;
};

export type StagingInserter = (rows: readonly RelationshipCandidateRow[]) => Promise<void>;

/**
 * Shapes extraction output into `bb_research.landscape_candidates` rows (lane
 * `'claims-relationship'`, status `'pending'`) and hands them to `insert`. Reuses
 * `landscape_candidates` per `entity-network-expansion.ts`'s convention rather than minting a new
 * table, distinguished only by `lane`. Never writes to `bb_canonical.*`.
 */
export async function stageRelationshipCandidates(
  candidates: readonly RelationshipCandidate[],
  runId: string,
  insert: StagingInserter,
  now: () => string = () => new Date().toISOString(),
): Promise<readonly RelationshipCandidateRow[]> {
  const discoveredAt = now();
  const rows: RelationshipCandidateRow[] = candidates.map((c, i) => ({
    id: `landcand_claims_${runId}_${i}_${c.fromEntityId}_${c.toEntityId}_${c.relationshipType}`,
    run_id: runId,
    lane: 'claims-relationship',
    source_program_id: 'claims-relationship-extraction',
    source_item_id: c.evidence.map((e) => e.claimId).join(','),
    display_name: `${c.fromEntityId} ${c.relationshipType} ${c.toEntityId}`,
    kind: 'other',
    summary: `${c.fromEntityId} ${c.relationshipType} ${c.toEntityId} (matched "${c.matchedPattern}")`,
    canonical_url: '',
    status: 'pending',
    provenance: {
      claim_ids: c.evidence.map((e) => e.claimId),
      matched_pattern: c.matchedPattern,
    },
    payload: {
      from_entity_id: c.fromEntityId,
      to_entity_id: c.toEntityId,
      relationship_type: c.relationshipType,
      ...(c.temporalContext !== undefined ? { valid_from: c.temporalContext.validFrom } : {}),
    },
    discovered_at: discoveredAt,
  }));
  await insert(rows);
  return rows;
}

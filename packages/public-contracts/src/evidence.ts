/**
 * Evidence semantics — the one language both platforms speak about how well a record is
 * supported.
 *
 * The archive stores confidence as `high` / `medium` / `low` / `unrated`. Readers see a
 * three-segment meter, a letter, and a sentence. Those are spellings of one fact, and this module
 * owns the mapping so the site and the app cannot drift.
 *
 * It used to live in `apps/web/src/lib/map-experience/evidence-grade.ts`, where the phone could
 * not reach it. Native surfaces therefore invented their own vocabulary — "High confidence" as a
 * plain fact-strip string — while the site showed a graded meter, so the same record read as two
 * different assessments depending on which screen you opened.
 *
 * Two rules the whole product depends on:
 *
 * - `unrated` has no letter and no filled segment. A record nobody assessed is not a D. Inventing
 *   a fourth grade for it presents absence of assessment as a low assessment.
 * - The meter is never the only cue. Every renderer pairs it with the letter or the sentence,
 *   because colour alone is not information.
 */

import type { ConfidenceTierV1 } from './v1/map.js';

export type ConfidenceTier = ConfidenceTierV1;

export type EvidenceGrade = 'A' | 'B' | 'C';

/** The floor a reader can set. `any` admits ungraded records; a letter does not. */
export type EvidenceFloor = 'any' | EvidenceGrade;

export const EVIDENCE_FLOORS: readonly EvidenceFloor[] = ['any', 'C', 'B', 'A'];

/** Segments in the canonical meter. Three, on every surface and both platforms. */
export const EVIDENCE_METER_SEGMENTS = 3;

const GRADE_BY_TIER: Readonly<Record<ConfidenceTier, EvidenceGrade | null>> = {
  high: 'A',
  medium: 'B',
  low: 'C',
  unrated: null,
};

/** Rank used for floor comparison. Higher is stronger. */
const GRADE_RANK: Readonly<Record<EvidenceGrade, number>> = { C: 1, B: 2, A: 3 };

export function gradeForConfidence(tier: ConfidenceTier | string): EvidenceGrade | null {
  return GRADE_BY_TIER[tier as ConfidenceTier] ?? null;
}

/** What the mono meta line prints. An em dash is banned in copy; this is a data placeholder. */
export function gradeLabel(grade: EvidenceGrade | null): string {
  return grade ?? '·';
}

/** Full phrase for `aria-label` and `title`, where a bare letter reads as noise. */
export function gradeDescription(grade: EvidenceGrade | null): string {
  return grade === null ? 'Evidence not graded' : `Evidence grade ${grade}`;
}

/** Filled segments for a confidence tier. Unrated is honestly empty, never a fourth colour. */
export function meterLevelForTier(tier: ConfidenceTier | string): number {
  switch (tier) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function meterLevelForCoverage(level: 'minimal' | 'partial' | 'substantial'): number {
  switch (level) {
    case 'substantial':
      return 3;
    case 'partial':
      return 2;
    default:
      return 1;
  }
}

/**
 * The sentence a screen reader hears in place of the bars.
 *
 * The count is appended only when the surface actually knows it. A record whose source count is
 * unavailable says nothing about sources rather than saying zero, because "0 sources" and "we did
 * not load the sources" are different claims and only one of them is true.
 */
export function evidenceMeterLabel(tier: ConfidenceTier | string, sourceCount?: number): string {
  const base = gradeDescription(gradeForConfidence(tier));
  if (typeof sourceCount !== 'number' || !Number.isFinite(sourceCount) || sourceCount < 0) {
    return base;
  }
  return `${base}, ${sourceCount === 1 ? '1 source' : `${sourceCount} sources`}`;
}

/**
 * The visible evidence label: "Grade A · 2 sources", or "Not graded" when nobody assessed it.
 *
 * Both platforms print this string. The web record sheet builds it and then splits it back apart
 * with `evidenceGradeWord` / `evidenceCountPhrase`, which only works while there is exactly one
 * way to build it.
 */
export function evidenceLabel(tier: ConfidenceTier | string, sourceCount?: number): string {
  const grade = gradeForConfidence(tier);
  const head = grade === null ? 'Not graded' : `Grade ${grade}`;
  if (typeof sourceCount !== 'number' || !Number.isFinite(sourceCount) || sourceCount < 0) {
    return head;
  }
  return `${head} · ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`;
}

/** The floor chip's own label. */
export function floorLabel(floor: EvidenceFloor): string {
  if (floor === 'any') return 'Any';
  if (floor === 'A') return 'A only';
  return `${floor} and up`;
}

/**
 * Does a record clear the floor? `any` admits everything including ungraded records; any letter
 * floor excludes ungraded ones, because a floor is a claim about assessed strength and an
 * unassessed record cannot satisfy it.
 */
export function meetsEvidenceFloor(tier: ConfidenceTier | string, floor: EvidenceFloor): boolean {
  if (floor === 'any') return true;
  const grade = gradeForConfidence(tier);
  if (grade === null) return false;
  return GRADE_RANK[grade] >= GRADE_RANK[floor];
}

/**
 * The floor is applied as its own predicate rather than through an exact-match `confidence` facet.
 * Routing "B and up" through an exact match would silently drop every grade A record — the
 * opposite of what the reader asked for.
 */
export function applyEvidenceFloor<
  T extends { readonly properties: { readonly confidenceTier: ConfidenceTier } },
>(features: readonly T[], floor: EvidenceFloor): readonly T[] {
  if (floor === 'any') return features;
  return features.filter((feature) => meetsEvidenceFloor(feature.properties.confidenceTier, floor));
}

/**
 * A claim, as much of one as grading needs.
 *
 * The archive spells a citation two ways and both reach this module: the stored projection and
 * web's `PublicClaimProjectionDoc` keep `citationSource` flat, while the wire `ClaimV1` and the
 * phone's `Claim` nest the same string under `citation.source`. Reading both here is what keeps
 * the rule single. An adapter at each call site would be five chances to map it wrong, and a
 * missed one fails silently — every record would look uncorroborated and the whole archive would
 * drop a grade.
 */
export type EvidenceClaimInput = {
  readonly confidenceLevel?: string;
  readonly citationSource?: string;
  readonly citation?: { readonly source?: string };
  /** What the claim asserts. The migration bridge for claims published without `claimRole`. */
  readonly predicate?: string;
  /** Whether this claim is the record's own index row or evidence about its subject. */
  readonly claimRole?: string;
};

/**
 * The lineage a citation belongs to, for corroboration counting.
 *
 * Two citations corroborate each other only when they are independent, and the source string is
 * not a reliable identity on its own: the archive stores one publisher under several spellings
 * (`wikipedia_api`, `wikipedia.org`, `en.wikipedia.org`, `en.m.wikipedia.org`). Counting those as
 * four sources would let a single publisher corroborate itself up to grade A.
 *
 * Subdomain prefixes are dropped and the Wikipedia family collapses to one key, matching the
 * confidence engine's `lineageRootId` rule that syndicated copies count once.
 */
export const WIKIPEDIA_LINEAGE_KEY = 'wikipedia';

export function citationLineageKey(claim: EvidenceClaimInput): string | null {
  const raw = (claim.citationSource ?? claim.citation?.source ?? '').trim().toLowerCase();
  if (raw.length === 0) return null;
  if (raw.includes('wikipedia') || raw.includes('wikidata')) return WIKIPEDIA_LINEAGE_KEY;
  return raw.replace(/^(?:www|en|en\.m|m)\./u, '');
}

/** The claim is the record's own index row, not a source about its subject. */
export const CLAIM_ROLE_RECORD_INDEX = 'record_index';

/**
 * Predicates the landscape publisher synthesises from a record's own index row.
 *
 * This is the bridge for claims published before `claimRole` existed, not the rule. The publisher
 * now states the role outright, because inferring provenance from a predicate vocabulary means a
 * new lane with different predicates is silently mis-graded. Once no published claim is missing
 * `claimRole` this set and its branch come out (repo-8dmey).
 */
const RECORD_PROVENANCE_PREDICATES: ReadonlySet<string> = new Set([
  'listing',
  'significant for',
  'documented_site',
]);

/**
 * True when a claim is the record's own index row rather than evidence about its subject.
 *
 * `incremental-publish.ts` builds those from the registry fields of the row the record was
 * created from and cites them to that row's canonical URL, so they are the record's provenance.
 * A record cited to its own index row has been corroborated by nothing.
 */
function isRecordProvenanceClaim(claim: EvidenceClaimInput): boolean {
  const role = (claim.claimRole ?? '').trim().toLowerCase();
  if (role.length > 0) return role === CLAIM_ROLE_RECORD_INDEX;
  return RECORD_PROVENANCE_PREDICATES.has((claim.predicate ?? '').trim().toLowerCase());
}

/**
 * Distinct lineages cited anywhere on the record, provenance and Wikipedia included.
 *
 * This answers whether anyone assessed the record at all, which is a different question to
 * whether it is corroborated. A record cited only to Wikipedia has been assessed, and so is
 * graded rather than reported `unrated`.
 */
export function citedLineageCount(claims: readonly EvidenceClaimInput[]): number {
  const lineages = new Set<string>();
  for (const claim of claims) {
    const key = citationLineageKey(claim);
    if (key !== null) lineages.add(key);
  }
  return lineages.size;
}

/**
 * Distinct lineages that are allowed to corroborate the record.
 *
 * Two exclusions. Neither is invented here, and neither can be expressed by the host string
 * alone, which is why counting hosts kept overstating the archive:
 *
 * - Wikipedia may carry a claim and may never corroborate one. `claim-corroborate` lists
 *   counting it as the second lineage under Never, and `isWikipediaHost` already keeps it out of
 *   every corroboration path on the ingest side. It reached grade A on 335 records here.
 * - A record's own index row is not a source about the record. Counting it let 784 records reach
 *   grade A on a single federal listing served by two agencies: the NARA catalog entry the record
 *   was seeded from, and the NPS nomination form carrying that same reference number.
 */
export function corroboratingLineageCount(claims: readonly EvidenceClaimInput[]): number {
  const lineages = new Set<string>();
  for (const claim of claims) {
    if (isRecordProvenanceClaim(claim)) continue;
    const key = citationLineageKey(claim);
    if (key !== null && key !== WIKIPEDIA_LINEAGE_KEY) lineages.add(key);
  }
  return lineages.size;
}

/** The strongest claim tier present, ignoring corroboration. */
function strongestClaimTier(claims: readonly EvidenceClaimInput[]): ConfidenceTier {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

/**
 * The evidence tier for a whole record: its strongest claim, capped by corroboration.
 *
 * The rule used to be the bare maximum, which is why 4,152 of 4,167 published records graded A
 * and the meter carried no signal at all. The maximum is not so much wrong as answering a
 * different question — "is any single claim here well sourced?" — while a reader looking at a
 * record-level grade is asking "is this record well supported?". Those come apart exactly where
 * it matters: 57% of the archive rests on one source, and 398 records were grading A on
 * Wikipedia alone.
 *
 * So a record cited to a single lineage cannot reach A, however authoritative that lineage is.
 * That standard is not invented here. It is what the confidence engine
 * (`calculateClaimConfidence`) already encodes, where one lineage scores 0.4 on
 * `lineageIndependence` and cannot clear the 0.75 publish threshold; this is the same rule
 * applied at the level a reader actually sees.
 *
 * Counting citation hosts was still too generous, because two of them are not second opinions:
 * Wikipedia, which may carry a claim but never corroborate one, and the record's own index row.
 * `corroboratingLineageCount` excludes both, which is what separates the lineages that can
 * support a grade from the lineages that merely exist. Grade A is 572 records under this rule,
 * from 1,807 when any two hosts counted (repo-goyut, repo-6jizv).
 *
 * A record with no citations is `unrated`, never `low` — nobody assessed it, which is not the
 * same as assessing it poorly. That test uses `citedLineageCount`, so a record carrying only
 * Wikipedia or only its index row is graded, and graded low, rather than reported unassessed.
 */
export function recordConfidenceTier(claims: readonly EvidenceClaimInput[]): ConfidenceTier {
  const strongest = strongestClaimTier(claims);
  if (strongest === 'unrated') return 'unrated';
  if (citedLineageCount(claims) === 0) return 'unrated';
  if (corroboratingLineageCount(claims) > 1) return strongest;
  // At most one lineage that can corroborate. Step down one grade.
  return strongest === 'high' ? 'medium' : 'low';
}

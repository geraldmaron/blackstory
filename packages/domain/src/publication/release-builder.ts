/**
 * Deterministically builds one entity's release projection and search document from
 * ReleaseSourceEntity. Shared helpers derive inclusion basis, research coverage, public
 * location precision and evidence-grading inputs. Callers adapt their canonical data into this
 * shape; release manifests and lifecycle transitions belong to the surrounding publication
 * module.
 */
import {
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
  currentStatus,
  type EntityStatusValue,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type StatusHistoryEntry,
} from '../entity-status.js';
import { deriveCatalogEntityStatus } from '../derive-catalog-status.js';
import { resolveEraBucketsFromEvidence } from '../era.js';
import { findTemplateSummarySignature } from './template-summary-signatures.js';
import type { LivingStatus } from '../living.js';
import { redactLocationForPublic, reducePublicPrecision } from '@repo/security/redaction';
import { sanitizePublicProseText } from '../editorial/prose-links.js';
import { evaluateNotabilityGate } from '../relevance/notability-gate.js';
import { evaluateFactPublishGate } from '../facts/publish-gate.js';
import type { FactCitation } from '../facts/citation.js';
import { isValidTopicId } from '../taxonomy/topics.js';
import { buildGeoPointFields, type GeoPointFields } from '../geography/geohash.js';
import { recordEvidenceInputs, type RecordEvidenceInputs } from '../evidence-inputs.js';
import { publicVisitForTier, type PublicVisit } from '../geography/visit.js';
import {
  evaluateGeoIntegrityPublishGate,
  type StateBoundaryIndex,
} from '../geo-integrity/index.js';
import { normalizeStateCode } from '../geo-integrity/containment.js';
import type { GeoIntegrityAuditOptions } from '../geo-integrity/audit.js';
import { US_STATES } from '../map/us-geography.js';
import type { PublicRelatedEntry } from '../graph/adjacency.js';
import type { RelationshipType, TemporalContext } from '../relationship.js';
import { RELATIONSHIP_TYPES } from '../relationship.js';
import { parseWaybackCaptureUrl } from '@repo/schemas';

export type ReleaseSourceClaim = {
  readonly id?: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  /** Verified public archive pointer for the exact cited URL. */
  readonly archivedUrl?: string;
  /** ISO timestamp encoded by archivedUrl. */
  readonly archivedAt?: string;
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
  /** `record_index` for a claim built from the record's own index row; `evidence` otherwise. */
  readonly claimRole?: ClaimRole;
};

export type ReleaseSourceRelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: TemporalContext;
};

export type ReleaseSourceEntity = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly eraBuckets?: readonly string[];
  readonly topicTags?: readonly string[];
  readonly topicIds?: readonly string[];
  readonly mentionedEntityIds?: readonly string[];
  readonly keywords?: readonly string[];
  readonly jurisdictionLabel: string;
  /** Explicit USPS postal code when known; wins over parsing `jurisdictionLabel`. */
  readonly jurisdictionStateCode?: string;
  readonly locationPrecision: string;
  readonly locationLabel: string;
  readonly lat: number;
  readonly lng: number;
  readonly claims?: readonly ReleaseSourceClaim[];
  readonly historicalContext?: string;
  readonly impactStatement?: string;
  readonly sensitivityClass?: string;
  readonly status?: string;
  readonly statusHistory?: readonly {
    readonly status: string;
    readonly validFrom?: string;
    readonly validTo?: string | null;
    readonly datePrecision: string;
    readonly basisClaimIds: readonly string[];
  }[];
  readonly livingStatus?: 'living' | 'deceased' | 'unknown';
  /** Bootstrap catalog related shortcuts; prefer `ReleaseBuildContext.relatedEntries` from graph. */
  readonly related?: readonly ReleaseSourceRelatedEntry[];
  /**
   * Raw visit-contact input (address/phone/website/hours/visitability), pre-gating. Prefer
   * `ReleaseBuildContext.visitOverride` when the caller has looked up
   * `canonical.entity_visit` + `entity_locations.street`/`postal_code` for a canonical
   * entity — same precedence as `locationOverride` above.
   */
  readonly visit?: PublicVisit;
};

export type ReleaseClaimProjection = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  readonly archivedUrl?: string;
  readonly archivedAt?: string;
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
  readonly claimRole?: ClaimRole;
};

export type ReleaseResearchCoverage = 'minimal' | 'partial' | 'substantial';

/**
 * Caller-supplied public location and match method that override source-entry coordinates.
 * Republishing may inherit an already-published location when the candidate lacks coordinates;
 * callers must preserve its recorded precision and provenance.
 */
export type ReleaseLocationOverride = {
  readonly lat: number;
  readonly lng: number;
  readonly precision?: string;
  readonly matchMethod?: string;
  readonly locationLabel?: string;
};

export type ReleaseBuildContext = {
  readonly releaseId: string;
  /** ISO instant this release build ran at. Legitimately real: a fresh publish IS being
   * generated/updated right now, unlike a render-time read. */
  readonly generatedAt: string;
  /** Geohash character precision; defaults to the bootstrap fixtures' choice of 5. */
  readonly geohashPrecision?: number;
  /**
   * Graph-derived related entries for this entity (from release adjacency). When present,
   * these win over bootstrap `entry.related` shortcuts.
   */
  readonly relatedEntries?: readonly PublicRelatedEntry[];
  /**
   * Preferred coordinates from a canonical EntityLocation (Census-validated). When present,
   * these win over catalog fixture lat/lng (`manual_research` fallback).
   */
  readonly locationOverride?: ReleaseLocationOverride;
  /**
   * Canonical visit-contact input (`canonical.entity_visit` joined with
   * `entity_locations.street`/`postal_code`), when the caller looked one up. Wins over
   * `entry.visit` — same precedence as `locationOverride` above. Gated through
   * `publicVisitForTier` before it reaches the projection; this is raw input, not the
   * already-filtered public shape.
   */
  readonly visitOverride?: PublicVisit;
  /**
   * Latest admin bulk catalog decision for this entity (apps/web/src/admin's catalog-decisions-store),
   * when the caller looked one up. A `flag_for_retraction` decision fails this entity closed —
   * the same fail-closed shape as the other gates below, not a silent skip.
   */
  readonly catalogDecision?: {
    readonly action: 'flag_for_retraction' | 'needs_review' | 'clear_flag';
    readonly reason: string;
  };
  /**
   * Opt-in geo-integrity publish gate. When `stateBoundaries` is present (here or via shorthand
   * `stateBoundaries` on this context), coordinates must lie inside the declared state's polygon.
   */
  readonly geoIntegrity?: {
    readonly stateBoundaries: StateBoundaryIndex;
    readonly toleranceDegrees?: number;
  };
  /** Shorthand for `geoIntegrity.stateBoundaries` when no other geo-integrity options are needed. */
  readonly stateBoundaries?: StateBoundaryIndex;
  /**
   * Authoritative lifecycle status from `canonical.entities`. When present for an entity,
   * canonical values win over heuristic derivation from summary text.
   */
  readonly canonicalStatus?: CanonicalStatusSnapshot;
};

/** Where release projection status fields were resolved. */
export type StatusProvenance = 'canonical' | 'derived_heuristic';

/** Canonical lifecycle fields loaded at publish time (subset of canonical.entities). */
export type CanonicalStatusSnapshot = {
  readonly livingStatus?: LivingStatus | 'not_applicable';
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
};

export type ResolvedReleaseProjectionStatus = {
  readonly status?: EntityStatusValue | 'living' | 'deceased' | 'presumed_deceased' | 'unknown';
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  readonly livingStatus?: LivingStatus;
  readonly statusProvenance: StatusProvenance;
};

export type ReleaseEntityProjectionFields = {
  readonly id: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly nameLower: string;
  readonly summary: string;
  readonly location: {
    readonly lat: number;
    readonly lng: number;
    readonly geohash: string;
    readonly geohashPrefixes: readonly string[];
    readonly precision: string;
    readonly matchMethod: string;
    /**
     * Present only when reducePublicPrecision coarsens the source location. The
     * location-precision standard defines the reason vocabulary; absence means no reduction was
     * applied.
     */
    readonly precisionReductionReason?: string;
  };
  readonly claimIds: readonly string[];
  readonly claims: readonly ReleaseClaimProjection[];
  readonly jurisdictionLabel: string;
  readonly locationLabel: string;
  /** Reader-facing visit contract, gated by `publicVisitForTier` on precision/kind/living status. */
  readonly visit?: PublicVisit;
  readonly status?: string;
  /** Time-scoped lifecycle designations that back `status`. Present when derived or authored. */
  readonly statusHistory?: readonly {
    readonly status: string;
    readonly validFrom?: string;
    readonly validTo?: string | null;
    readonly datePrecision: string;
    readonly basisClaimIds: readonly string[];
  }[];
  /** Person living-status signal (canonical-first at publish). */
  readonly livingStatus?: LivingStatus;
  /** Whether status/livingStatus came from canonical or heuristic backstop. */
  readonly statusProvenance?: StatusProvenance;
  readonly eraBuckets?: readonly string[];
  readonly sensitivityClass?: string;
  readonly topicTags: readonly string[];
  readonly topicIds: readonly string[];
  readonly mentionedEntityIds: readonly string[];
  readonly keywords: readonly string[];
  readonly notabilityLabels: readonly string[];
  readonly notabilityBasis: readonly NotabilityBasisRecord[];
  readonly researchCoverage: ReleaseResearchCoverage;
  readonly historicalContext?: string;
  readonly impactStatement?: string;
  /** Typed related entries from graph adjacency (or catalog bootstrap fallback). */
  readonly related?: readonly PublicRelatedEntry[];
  /** Real release-build-time timestamps (see module doc comment). */
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
};

/**
 * Projects grading inputs for the shared read-time confidence rule. Caching a finished tier
 * would leave existing records stale whenever the rule changes.
 */
export {
  CLAIM_ROLE_RECORD_INDEX,
  recordEvidenceInputs,
  type EvidenceClaimLevel,
  type EvidenceInputClaim,
  type RecordEvidenceInputs,
} from '../evidence-inputs.js';

/** Whether a claim is the record's own index row or evidence about its subject. */
export type ClaimRole = 'record_index' | 'evidence';

export type ReleaseSearchIndexFields = {
  readonly id: string;
  readonly releaseId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly nameLower: string;
  readonly aliases: readonly string[];
  readonly summary: string;
  readonly topicTags: readonly string[];
  readonly topicIds: readonly string[];
  readonly mentionedEntityIds: readonly string[];
  readonly keywords: readonly string[];
  readonly jurisdictionState: string;
  readonly status?: string;
  readonly eraBuckets: readonly string[];
  readonly notabilityBasis: readonly NotabilityBasisRecord[];
  readonly notabilityLabels: readonly string[];
  readonly sensitivityClass?: string;
  readonly recordMaturity: string;
  readonly researchCoverage: ReleaseResearchCoverage;
  readonly relatedCount: number;
  readonly claimCount: number;
  /**
   * The grading inputs `/records` reads its evidence floors from, so the slim index carries the
   * ingredients rather than a conclusion a rule change can strand. Never a ranking score.
   */
  readonly evidenceInputs: RecordEvidenceInputs;
};

export type ReleaseBuildFailureReason =
  | 'no_citations'
  | 'notability_basis_gate'
  | 'reference_resolution'
  | 'catalog_decision_retracted'
  | 'geo_integrity_gate';

export type ReleaseBuildResult =
  | {
      readonly ok: true;
      readonly projection: ReleaseEntityProjectionFields;
      readonly searchIndex: ReleaseSearchIndexFields;
    }
  | { readonly ok: false; readonly reason: ReleaseBuildFailureReason; readonly message: string };

/** Synthesizes a stable claim id when the source entry omitted one. Exported so callers that
 * need to cross-reference a claim id before/after building (e.g. gate wiring) agree with the
 * builder on the exact same id for the exact same claim. */
export function resolveReleaseClaimId(
  entry: Pick<ReleaseSourceEntity, 'id'>,
  claim: ReleaseSourceClaim,
  index: number,
): string {
  return claim.id ?? `claim_${entry.id.replace(/^ent_/, '')}_${String(index + 1).padStart(2, '0')}`;
}

function buildClaimProjections(entry: ReleaseSourceEntity): readonly ReleaseClaimProjection[] {
  return (entry.claims ?? []).map((claim, index) => {
    const hasArchiveField = claim.archivedUrl !== undefined || claim.archivedAt !== undefined;
    const pointer =
      claim.archivedUrl !== undefined && claim.citationHref !== undefined
        ? parseWaybackCaptureUrl(claim.archivedUrl, claim.citationHref)
        : null;
    if (
      hasArchiveField &&
      (claim.archivedUrl === undefined ||
        claim.archivedAt === undefined ||
        claim.citationHref === undefined ||
        pointer === null ||
        pointer.capturedAt !== claim.archivedAt)
    ) {
      throw new Error(`Claim ${claim.id ?? index} carries an invalid archive pointer`);
    }
    return {
      id: resolveReleaseClaimId(entry, claim, index),
      predicate: claim.predicate,
      object: sanitizePublicProseText(claim.object),
      confidenceLevel: claim.confidenceLevel,
      citationSource: claim.citationSource,
      ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
      ...(claim.archivedUrl !== undefined ? { archivedUrl: claim.archivedUrl } : {}),
      ...(claim.archivedAt !== undefined ? { archivedAt: claim.archivedAt } : {}),
      citationLabel: claim.citationLabel,
      ...(claim.independentLineageCount !== undefined
        ? { independentLineageCount: claim.independentLineageCount }
        : {}),
      ...(claim.claimRole !== undefined ? { claimRole: claim.claimRole } : {}),
    };
  });
}

function claimToFactCitationStandIn(claim: ReleaseSourceClaim): FactCitation {
  // A structural citation marker supports the no_citations check. It does not prove
  // archived-capture completeness or passage entailment; those require the evidence publication
  // gates.
  return {
    csl: {
      id: claim.citationSource,
      type: 'webpage',
      ...(claim.citationHref !== undefined ? { URL: claim.citationHref } : {}),
    },
    sourceClass: 'secondary',
    role: 'supports',
    excerpt: claim.citationLabel,
  };
}

/**
 * Best-effort, honest keyword mapping from a claim's own predicate+object text to the closest
 * matching `NotabilityCriterion`. This never OVERCLAIMS: a criterion is only assigned when the
 * claim text itself contains a reasonably unambiguous marker for it (e.g. "first", "national
 * register", "hall of fame", "only"/"oldest"); every other claim honestly falls back to the
 * broadest criterion that is true of the record, rather than inventing a more specific rubric
 * match the source text doesn't support.
 *
 * The fallback depends on `kind`. It was `documented_site` for everything, on the reasoning that
 * every record in this catalog is "by construction, a documented site/entity in the active public
 * release". That stopped being true when `invention` became a kind: an invention happens at no
 * site a reader can walk to, so the fallback printed "a documented site of a historically
 * significant event or practice (a sit-in lunch counter, a Freedom School…)" on Latimer's carbon
 * process. Inventions fall back to `documented_contribution` instead.
 *
 * The keyword matches still run first for every kind, and correctly: Jennings's grant is the
 * earliest known US patent to a Black inventor, and `first_to_do_x` is the honest criterion for
 * it whatever the record's kind.
 */
/**
 * Matches a racial-terror killing of the record's subject from the predicate. Object text can
 * mention violence documented or opposed by a chronicler and must not classify that chronicler
 * as a victim. Lynched can stand alone; killed or hanged require additional context to exclude
 * military deaths and judicial executions.
 */
const RACIAL_TERROR_KILLED_PREDICATE =
  /\blynched\b|\b(?:was|were)\s+(?:hanged|hung|burned\s+alive|murdered|beaten\s+to\s+death)\b|reclassified\s+as\s+a\s+lynching|\bis\s+a\s+documented\s+instance\s+of\b.*\blynch|\bbody\s+was\s+(?:found|recovered)\b|\bhad\s+body\s+recovered\b/i;

/** Harm verbs that only mean racial terror when the claim supplies the context. */
const RACIAL_TERROR_HARMED_PREDICATE =
  /\b(?:was|were)\s+(?:the\s+|a\s+)?victims?\s+of\b|\bdied\s+(?:as\s+a\s+result\s+of|by|from|in)\b/i;

/** `lynch\w*` cannot match Lynchburg: the city needs `lynchb`, and \w* is preceded by a boundary. */
const RACIAL_TERROR_CONTEXT =
  /(?:lynch\w*|racial\s+terror|racial\s+violence|\bmob\b|hate\s+crime)/i;

/**
 * Record-wide perpetrator context is consulted only alongside a killing predicate. Generic
 * references to a mob or hate crime are insufficient. Do not add victim cohort names to
 * compensate for missing claims; repair those records from evidence.
 */
const RACIAL_TERROR_RECORD_CONTEXT =
  /white[\s-]?supremacis[tm]|white\s+mobs?|white\s+militia|ku\s+klux\s+klan|\bklan\b|lynch\w*|racial\s+terror|racial\s+violence|racist\s+attack/i;

/**
 * A predicate recording that the record's own subject was killed, WITHOUT saying by whom.
 *
 * These cannot stand alone the way `lynched` can. "Was killed in action" is Doris Miller aboard
 * the USS Liscome Bay; "shot and killed" is equally a police shooting, which this catalog treats
 * as a separate cohort (see `documented_racial_killing` in docs/methodology/notability-rubric.md).
 * A match here is only half a test — `RACIAL_TERROR_RECORD_CONTEXT` supplies the other half.
 *
 * `killed` is here rather than in `RACIAL_TERROR_KILLED_PREDICATE` for exactly that reason, which
 * is why the lynching pass could not reach the Emanuel Nine: their claims read `killed`,
 * `killed_during`, `killed_in`, and Tywanza Sanders's record carries the predicate six times and
 * no context at all — his summary is the only place the massacre is named.
 */
const RACIAL_TERROR_KILLING_PREDICATE = /\bkilled\b|\bvictims?\s+of\b/i;

/**
 * Catalog predicates are snake_case keys (`killed_in`, `victim_of`) as often as they are prose
 * (`was killed in action`). `_` is a word character, so `\bkilled\b` does not match `killed_in`
 * — the four girls killed at 16th Street Baptist Church slipped straight through the first
 * version of this test for exactly that reason. Normalize before matching.
 */
function predicateWords(predicate: string): string {
  return predicate.replaceAll('_', ' ');
}

/**
 * A mass killing that IS the record, rather than an event a person's record refers to. Event and
 * `other` records carry no killing predicate of their own — the Tulsa Race Massacre's claims are
 * `occurred in`, `targeted`, `estimated deaths`, `destroyed` — so the name carries the test.
 *
 * `riot` is deliberately absent. It is the word the perpetrators' press used for Tulsa and Ocoee,
 * and it is also the honest word for 1967 Detroit and Newark, which are a different phenomenon.
 */
const MASS_RACIAL_KILLING_NAME = /\bmassacres?\b|\blynching\b|\bpogroms?\b/i;

/** True when this claim records a racial-terror killing of the record's own subject. */
export function isRacialTerrorClaim(predicate: string, object: string): boolean {
  if (RACIAL_TERROR_KILLED_PREDICATE.test(predicate)) return true;
  return (
    RACIAL_TERROR_HARMED_PREDICATE.test(predicate) &&
    RACIAL_TERROR_CONTEXT.test(`${predicate} ${object}`)
  );
}

/**
 * Killing under a claim of authority: by police, by someone acting under a claim of authority or
 * self-defense, or by a private individual. Checked only AFTER racial terror, which is what keeps
 * the lynching cohort out of it — Albert Gooden's body was recovered "by sheriff's deputies", and
 * a sheriff in a claim does not make a 1900 lynching a police killing.
 */
const AUTHORITY_KILLING_CONTEXT =
  /\bpolice\b|\bofficers?\b|\bNYPD\b|\bpatrolm[ae]n\b|\btroopers?\b|\bdeputies\b|\bhighway\s+patrol\b|\bneighborhood[\s-]?watch\b|\bstand[\s-]your[\s-]ground\b|\bchokehold\b|\bin\s+custody\b|\bno-knock\b|\bsearch\s+warrant\b/i;

/**
 * Classifies killings by police or others claiming authority to use force using the separate
 * documented_police_killing criterion. Racial-terror classification runs first. Keep the
 * criteria distinct because they require different documentary support; see
 * docs/methodology/notability-rubric.md.
 */
export function isRacialKillingRecord(
  entry: Pick<ReleaseSourceEntity, 'kind' | 'displayName' | 'summary'>,
  claims: readonly ReleaseClaimProjection[],
): boolean {
  if (!claims.some((claim) => isKillingPredicate(claim.predicate))) return false;
  const context = [
    entry.summary ?? '',
    ...claims.map((claim) => `${claim.predicate} ${claim.object}`),
  ].join(' ');
  return AUTHORITY_KILLING_CONTEXT.test(context);
}

/**
 * True when the RECORD is about a documented act of racial terror, read from everything the
 * record carries rather than from one claim at a time.
 *
 * `isRacialTerrorClaim` asks whether one sentence records a killing. That question cannot reach a
 * record whose sentences are split across claims — Susie Jackson's say `killed`, `date`,
 * `location` and `group | Emanuel Nine`, and none of them alone says both what happened and who
 * did it. All nine of the Emanuel Nine, the four girls killed at 16th Street Baptist Church and
 * every massacre in the catalog published as documented SITES for that reason.
 *
 * Two arms, and both keep the same two-part shape the claim-scoped rule has:
 *
 *   A person is a racial-terror record when a claim predicate says the subject was killed AND the
 *   record names a perpetrator — a white mob, a white-supremacist attack, the Klan, a lynching.
 *   Requiring the killing predicate is what keeps the chroniclers out: Ida B. Wells's record is
 *   saturated with lynching and has no claim saying she was killed.
 *
 *   An event or place is a racial-terror record when its NAME is a mass racial killing and it
 *   carries the same perpetrator context. Those records have no killing predicate to test.
 *
 * Deliberately NOT matched: the Orangeburg Massacre and Delano Middleton, killed by South Carolina
 * highway patrolmen, and Breonna Taylor, Trayvon Martin and Eric Garner. A killing by police or by
 * a civilian claiming authority rests on a different documentary record and gets its own criterion
 * once ratified — see `documented_racial_killing` in docs/methodology/notability-rubric.md. The
 * perpetrator half of this test is what holds that line: none of those records names a white mob,
 * a supremacist attack or the Klan.
 */
export function isRacialTerrorRecord(
  entry: Pick<ReleaseSourceEntity, 'kind' | 'displayName' | 'summary'>,
  claims: readonly ReleaseClaimProjection[],
): boolean {
  if (claims.some((claim) => isRacialTerrorClaim(claim.predicate, claim.object))) return true;

  const context = [
    entry.summary ?? '',
    ...claims.map((claim) => `${claim.predicate} ${claim.object}`),
  ].join(' ');
  if (!RACIAL_TERROR_RECORD_CONTEXT.test(context)) return false;

  if (claims.some((claim) => RACIAL_TERROR_KILLING_PREDICATE.test(predicateWords(claim.predicate))))
    return true;
  return MASS_RACIAL_KILLING_NAME.test(entry.displayName ?? '');
}

/** True when this claim predicate is the one that records the killing, on such a record. */
/**
 * Any predicate that records the subject's death, whatever killed them. Two jobs, both of which
 * need the broad reading:
 *
 *   Half the `documented_racial_killing` test, alongside the authority context. `died` is far too
 *   generic to stand alone — everyone dies — but it is the word these records actually use: Eric
 *   Garner's claim is `died | after a chokehold during an arrest` and Jordan Neely's is
 *   `died | Jordan Neely`. Neither says "killed" anywhere.
 *
 *   Which claims survive M1 on a killing record. With the narrower racial-terror set here, Jordan
 *   Neely kept publishing "Boarded northbound F train." and "Stopped at Broadway-Lafayette Street
 *   station." as reasons he is in this catalog.
 *
 * This is NOT the racial-terror test. That one is deliberately stricter, because "was killed in
 * action" is Doris Miller.
 */
export function isKillingPredicate(predicate: string): boolean {
  return /\bkilled\b|\bshot\b|\bdied\b|\bvictims?\s+of\b/iu.test(predicateWords(predicate));
}

export function isRacialTerrorKillingPredicate(predicate: string): boolean {
  return (
    RACIAL_TERROR_KILLED_PREDICATE.test(predicate) ||
    RACIAL_TERROR_KILLING_PREDICATE.test(predicateWords(predicate))
  );
}

/**
 * A claim that records an ACCUSATION against the record's own subject. Such a claim may be true
 * record content and still be disqualified from `notabilityBasis`, which answers "why is this in
 * the catalog" — an allegation is never that answer.
 *
 * The rule is general, but it exists because of what it was doing to memorial records. Alma Howze
 * was lynched from the Shubuta bridge in 1918, pregnant, alongside her sister and two brothers,
 * after being charged with murder and taken from the jail before any trial. Her published
 * inclusion basis read "Was accused of alleged murder of a dentist." — the mob's own pretext,
 * printed as this catalog's reason for naming her. The Equal Justice Initiative's Lynching in
 * America records that nearly every victim was killed without being legally convicted of any
 * offense and that such accusations were routinely fabricated and rarely investigated.
 *
 * Matches the accusation verbs only. `arrested` and `convicted` are deliberately NOT here: for a
 * civil-rights record an arrest is frequently the honorable fact ("arrested at the sit-in"), and
 * "resulting in federal convictions" describes the killers, not the victim.
 */
const ACCUSATION_CLAIM =
  /\b(accused|accusation|alleged|allegedly|charged with|indicted|suspected)\b/i;

/** True when this claim predicate records an accusation against the subject. */
export function isAccusationPredicate(predicate: string): boolean {
  return ACCUSATION_CLAIM.test(predicate);
}

/**
 * Predicates that record a judicial decision. `court_precedent` already covered these and the
 * ladder simply never matched their phrasing: on the active release 42 case records opened
 * "Decided on" and 30 "Held that", while the ladder tested only
 * /precedent|supreme court|ruled|struck down|upheld/. Twenty-one PLACES were filed as judicial
 * precedents and four actual court cases were.
 */
const JUDICIAL_DECISION_PREDICATE =
  /\bdecided\s+on\b|\bissued\s+ruling\b|\baffirmed\b|\breversed\b|\boverturned\b|\bcertiorari\b|\bremand\w*\b|\bdissent\w*\b/i;

/**
 * A court's holding, matched across predicate AND object because the two halves carry one phrase:
 * the 30 case records read `held | that Alabama's law...`. Bare `held` cannot be the test — Anna
 * M. Dumas's "Held office until 1885." made a Reconstruction officeholder a judicial precedent.
 */
const JUDICIAL_HOLDING = /\bheld\s+that\b/i;

/**
 * Predicates that record a law being made. Deliberately separate from the judicial set: the Civil
 * Rights Act of 1964 is not a judicial decision, and filing it under `court_precedent` would state
 * something false about every statute, amendment and executive order in the catalog.
 */
const ENACTMENT_PREDICATE =
  /\bsigned\s+on\b|\bratified\s+on\b|\benacted\s+on\b|\bapproved\s+on\b|\bissued\s+on\b|\bcodified\s+as\b|\bpassed\s+by\b|\brepealed\b|\bauthorized\s+the\b|\bprohibits\b|\brequires\b/i;

/**
 * Predicates that record holding office. Only half the test — the OBJECT has to name a public
 * office, because `served_as` is equally "served as chief of neurosurgery at the Children's
 * Hospital of Michigan". Alexa Canady is in this catalog as a documented first, not as an
 * officeholder, and this rule must not claim otherwise.
 */
const OFFICE_PREDICATE =
  /\bserved\s+(?:as|in|during)\b|\brepresented\b|\b(?:was|were)\s+elected\b|\bheld\s+office\b|\bserved\s+as\s+member\s+of\b|\bappointed\s+(?:as|to)\b/i;

/** A public office, named. Legislative, executive, judicial, military commission, or local. */
const PUBLIC_OFFICE_OBJECT =
  /\bhouse\s+of\s+(?:representatives|delegates)\b|\bstate\s+(?:senate|house|representative|senator)\b|\b(?:u\.?s\.?|united\s+states)\s+(?:senate|congress|representative|senator|congressman)\b|\bgeneral\s+assembly\b|\blegislature\b|\bcity\s+council\b|\balderman\b|\bcouncilman\b|\bmayor\b|\bgovernor\b|\battorney\s+general\b|\bsecretary\s+of\b|\bjustice\s+of\s+the\s+peace\b|\bconstable\b|\bsheriff\b|\bcoroner\b|\bregister\s+of\b|\bcommissioner\b|\bdelegate\b|\bmagistrate\b|\bcabinet\b|\bambassador\b|\bjudge\b|\bReconstruction\s+era\b|\bconstitutional\s+convention\b/i;

/**
 * A museum, archive, library or research center of Black history — the keeping half of
 * `black_press_or_archive`. The making half is `kind === 'publication'`, which needs no keyword.
 */
const ARCHIVE_NAME =
  /\bmuseum\b|\barchives?\b|\bresearch\s+center\b|\bcultural\s+center\b|\bheritage\s+center\b|\bhistory\s+center\b|\blibrary\b|\bcollection\b/i;

/**
 * A long-standing community institution, in the words the rubric already uses: a historically
 * Black church, a fraternal lodge, an HBCU, a mutual aid society. `community_anchor` was in use
 * FOUR times in the whole catalog, all on people, and never once on a school, institution or
 * organization — the three kinds its ratified text is written about.
 */
const COMMUNITY_ANCHOR_NAME =
  /\bA\.?M\.?E\.?\b|\bbaptist\b|\bchurch\b|\bchapel\b|\bcongregation\b|\blodge\b|\bmasonic\b|\bfraternity\b|\bsorority\b|\bRosenwald\b|\bhistorically\s+black\s+(?:college|universit)\w*\b|\bHBCU\b|\bmutual\s+aid\b|\bbenevolent\b|\bfreedmen'?s?\b|\bnormal\s+(?:school|institute)\b/i;

/**
 * A named movement, or the organizing done inside one. The rubric text already names "person,
 * organization, event, place, or a movement-kind entity itself"; the criterion was in use on 36
 * records, every one of them a person.
 */
const MOVEMENT_NAME =
  /\bcivil\s+rights\s+movement\b|\bgreat\s+migration\b|\bblack\s+power\b|\bblack\s+arts\b|\bharlem\s+renaissance\b|\bunderground\s+railroad\b|\babolition\w*\b|\bfreedom\s+(?:rides?|riders?|summer|vote|school)\b|\bsit-?ins?\b|\bboycott\b|\bdesegregat\w*\b|\bvoter\s+registration\b|\bmarch\s+on\s+washington\b/i;

/**
 * Uses structured kind for homogeneous inclusion categories. Heterogeneous kinds such as
 * person, school and organization require positive evidence matching rather than a kind-only
 * criterion.
 */
/** Kinds whose records can carry a movement role — the kinds `movement_significance` names. */
const MOVEMENT_ANCHOR_KINDS = new Set(['organization', 'event', 'person']);

/** Kinds `community_anchor` is written about: a church, a lodge, an HBCU, a mutual aid society. */
const COMMUNITY_ANCHOR_KINDS = new Set(['school', 'institution', 'organization']);

const KIND_FALLBACK: Readonly<Record<string, NotabilityCriterion>> = {
  invention: 'documented_contribution',
  case: 'court_precedent',
  law: 'enacted_law',
  publication: 'black_press_or_archive',
  movement: 'movement_significance',
};

export function inferNotabilityCriterionFromClaim(
  predicate: string,
  object: string,
  kind?: string,
): NotabilityCriterion {
  const text = `${predicate} ${object}`.toLowerCase();
  // Checked before every other branch. A claim that records someone's killing must never be
  // classified as anything else — least of all `first_to_do_x`, which a phrase like "the first
  // Black man lynched in the county" would otherwise match and turn a murder into an achievement.
  if (isRacialTerrorClaim(predicate, object)) return 'documented_racial_terror';
  if (/\bfirst\b/.test(text)) return 'first_to_do_x';
  if (/national register|national historic landmark|\blandmark\b/.test(text)) {
    return 'landmark_or_national_register';
  }
  if (/hall of fame|pulitzer|congressional gold medal|national medal/.test(text)) {
    return 'major_honor_or_hall_of_fame';
  }
  if (/\bonly\b|\boldest\b/.test(text)) return 'only_or_oldest';
  if (/precedent|supreme court|ruled|struck down|upheld/.test(text)) return 'court_precedent';
  if (JUDICIAL_DECISION_PREDICATE.test(predicate) || JUDICIAL_HOLDING.test(text)) {
    return 'court_precedent';
  }
  if (ENACTMENT_PREDICATE.test(predicate)) return 'enacted_law';
  // A patent on a PERSON record. `documented_contribution` was in use on 19 records, every one of
  // them kind `invention` and none of them a person, so Elijah McCoy, Granville Woods, Garrett
  // Morgan and Marie Van Brittan Brown were not filed as contributors to anything.
  if (/\bpatented\b|\binvented\b|\bdesigned\b.*\bpatent\b/.test(predicate)) {
    return 'documented_contribution';
  }
  if (OFFICE_PREDICATE.test(predicate) && PUBLIC_OFFICE_OBJECT.test(object)) {
    return 'elected_or_appointed_office';
  }
  // The name-based matchers are gated to the kinds each criterion's ratified text is written
  // about. Without the gate, "A church that stood through it." on a PLACE became a
  // `community_anchor` — a criterion that demands "a documented multi-decade role in a specific
  // community", which one clause mentioning a church does not evidence. A criterion is only as
  // honest as the narrowest claim it will accept.
  //
  // `place` is absent from all three on purpose. Places already reach `documented_site` and
  // `landmark_or_national_register` honestly, and the ruling scoped the rubric decision to
  // non-place records.
  if (MOVEMENT_ANCHOR_KINDS.has(kind ?? '') && MOVEMENT_NAME.test(text)) {
    return 'movement_significance';
  }
  if (kind === 'institution' && ARCHIVE_NAME.test(text)) return 'black_press_or_archive';
  if (COMMUNITY_ANCHOR_KINDS.has(kind ?? '') && COMMUNITY_ANCHOR_NAME.test(text)) {
    return 'community_anchor';
  }
  return KIND_FALLBACK[kind ?? ''] ?? 'documented_site';
}

/** True when `criterion` is a member of the closed `NotabilityCriterion` enum this domain
 * package defines (defensive check the builder's own inference function only ever returns a
 * member of `NOTABILITY_CRITERIA`, but callers passing external strings should validate too). */
export function isNotabilityCriterion(value: string): value is NotabilityCriterion {
  return (NOTABILITY_CRITERIA as readonly string[]).includes(value);
}

/**
 * Turns a claim predicate + object into one inclusion-evidence sentence.
 * Predicates are snake_case catalog keys (`served_as`, `bombed_on`); objects are EITHER a
 * lowercase continuation authored to follow such a key, or a sentence the enrichment lane wrote
 * that already stands on its own. Only the first of those may be joined to the predicate;
 * joining the second is what produced "Founded in Washington and a small group opened …". When
 * the two are joined, the predicate is sentence-cased and joined without a colon so public copy
 * reads as prose, not a field dump. Source names belong in the citation list (evidenceIds), not
 * inline in the note.
 */
/**
 * Function words carry no verb meaning, so a predicate and an object sharing one is not a repeat.
 * Kept deliberately small: it exists only to find the VERB position at the front of a snake_case
 * predicate key (`was_literate` -> `literate`), not to parse English.
 */
const PREDICATE_FUNCTION_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

/** The predicate's first meaning-bearing word — the verb slot these catalog keys open with. */
function predicateLeadWord(lead: string): string {
  for (const word of lead.toLowerCase().split(/[^a-z']+/u)) {
    if (word.length > 0 && !PREDICATE_FUNCTION_WORDS.has(word)) return word;
  }
  return '';
}

/**
 * Verb forms a claim object opens or carries when it is a sentence of its own. Regular forms are
 * caught by the `-ed` test in `isObjectVerbForm`; this set exists for the irregulars that test
 * cannot see ("won", "led", "became", "known"). Like `PREDICATE_FUNCTION_WORDS` it is kept small
 * on purpose and is not an attempt to parse English — it only has to separate "Young was elected
 * to the U.S. House" from "National Register of Historic Places".
 */
const OBJECT_VERB_FORMS = new Set([
  'are',
  'began',
  'begun',
  'beat',
  'became',
  'become',
  'bore',
  'born',
  'bought',
  'broke',
  'brought',
  'built',
  'came',
  'can',
  'caught',
  'chose',
  'chosen',
  'could',
  'cut',
  'did',
  'do',
  'does',
  'drew',
  'driven',
  'drove',
  'fell',
  'felt',
  'fought',
  'found',
  'gave',
  'given',
  'got',
  'grew',
  'grown',
  'had',
  'has',
  'have',
  'held',
  'hit',
  'is',
  'kept',
  'knew',
  'known',
  'led',
  'left',
  'lost',
  'made',
  'may',
  'met',
  'might',
  'must',
  'paid',
  'put',
  'ran',
  'read',
  'rose',
  'said',
  'sang',
  'sat',
  'saw',
  'seen',
  'sent',
  'set',
  'shall',
  'shot',
  'should',
  'shown',
  'sold',
  'spoke',
  'stood',
  'struck',
  'swore',
  'taken',
  'taught',
  'threw',
  'told',
  'took',
  'was',
  'went',
  'were',
  'will',
  'won',
  'wore',
  'would',
  'wrote',
  'written',
]);

/** Month names. An object opening with one ("April 4, 1968, shot on the balcony …") is a date
 * continuation of the predicate, not a sentence, even though it opens with a capital. */
const OBJECT_DATE_LEAD_WORDS = new Set([
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]);

/** Abbreviations whose trailing period ends a word, not a sentence — "Killed Daniel L. Simmons
 * Sr." and "Location Washington, D.C." are names, and both need their predicate kept. */
const OBJECT_TRAILING_ABBREVIATIONS = new Set([
  'co.',
  'dr.',
  'inc.',
  'jr.',
  'mr.',
  'mrs.',
  'ms.',
  'no.',
  'sr.',
  'st.',
  'v.',
  'vs.',
]);

function sentenceCase(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function asSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** A lowercase token that carries tense — the signal that an object has a verb of its own. */
function isObjectVerbForm(word: string): boolean {
  return OBJECT_VERB_FORMS.has(word) || /^[a-z]{2,}ed$/u.test(word);
}

/** "April 4, 1968, shot on the balcony of the Lorraine Motel" — a date, so a continuation. */
function objectOpensWithADate(body: string): boolean {
  const [first] = body.split(/[\s,]+/u);
  return (
    first !== undefined &&
    OBJECT_DATE_LEAD_WORDS.has(first.toLowerCase()) &&
    /^\w+\s+\d/u.test(body)
  );
}

/** Terminal punctuation that is not an abbreviation's period. */
function objectEndsASentence(body: string): boolean {
  if (/[!?]$/u.test(body)) return true;
  if (!/\.$/u.test(body)) return false;
  const last = body.split(/\s+/u).at(-1) ?? '';
  if (OBJECT_TRAILING_ABBREVIATIONS.has(last.toLowerCase())) return false;
  // "U.S.", "D.C.", "L." — initials, whose period belongs to the name.
  return !/^(?:[A-Za-z]\.)+$/u.test(last);
}

/** "Became the first Black president …", "Inducted into the Rock and Roll Hall of Fame …" — the
 * object's own verb is its first word. The lowercase second word is what separates those from
 * the proper-noun phrases "United States Supreme Court Building" and "Marked Tree, Arkansas". */
function objectOpensWithItsOwnVerb(body: string): boolean {
  const [first, second] = body.split(/\s+/u);
  if (first === undefined || second === undefined) return false;
  return (
    isObjectVerbForm(trimEdges(first, isAsciiLetter, 'end').toLowerCase()) && /^[a-z]/u.test(second)
  );
}

const isAsciiLetter = (code: number): boolean =>
  (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const isAsciiLetterOrHyphen = (code: number): boolean => isAsciiLetter(code) || code === 45;

/**
 * Strips characters that fail `keep` from one or both ends, in one linear pass per end.
 *
 * This replaces `replace(/[^A-Za-z]+$/u, '')`-style trims, which backtrack quadratically on a long
 * run of non-letters followed by a letter ("@@@…@a"): the engine retries the run from every start
 * position before the `$` fails. Release text is input to this builder, so the trim has to be
 * linear whatever the token holds.
 */
function trimEdges(
  token: string,
  keep: (code: number) => boolean,
  ends: 'start' | 'end' | 'both',
): string {
  let start = 0;
  let end = token.length;
  if (ends !== 'end') while (start < end && !keep(token.charCodeAt(start))) start += 1;
  if (ends !== 'start') while (end > start && !keep(token.charCodeAt(end - 1))) end -= 1;
  return token.slice(start, end);
}

/**
 * A lowercase verb anywhere in the object — "Foster hurled complete game shutouts …".
 *
 * An `-ed` word does NOT count when it ends the object or is followed by "by", because those are
 * the two positions where it is a passive participle modifying the noun in front of it rather
 * than that noun's verb: "Africans freed BY Royal Navy" and "Between 62 and 153 Black men killed"
 * are noun phrases and still need their predicate. Auxiliaries carry tense wherever they sit and
 * are not subject to that test. Hyphenated tokens are skipped because "Black-owned" is an
 * adjective, not a verb.
 */
function objectCarriesItsOwnVerb(body: string): boolean {
  const tokens = body
    .split(/\s+/u)
    .map((raw) => trimEdges(raw, isAsciiLetterOrHyphen, 'both'))
    .filter((token) => token.length > 0);
  for (const [index, token] of tokens.entries()) {
    if (token.includes('-') || token !== token.toLowerCase()) continue;
    if (OBJECT_VERB_FORMS.has(token)) return true;
    if (!/^[a-z]{2,}ed$/u.test(token)) continue;
    const next = tokens[index + 1];
    if (next !== undefined && next.toLowerCase() !== 'by') return true;
  }
  return false;
}

/**
 * True when the object is a sentence in its own right, so the predicate must NOT be joined onto
 * the front of it. An object that opens lowercase or with a digit is a continuation by
 * construction and never reaches the tests below.
 */
function objectIsSelfStanding(body: string): boolean {
  if (!/^\p{Lu}/u.test(body)) return false;
  if (objectOpensWithADate(body)) return false;
  return (
    objectEndsASentence(body) || objectOpensWithItsOwnVerb(body) || objectCarriesItsOwnVerb(body)
  );
}

export function formatClaimInclusionNote(predicate: string, object: string): string {
  const lead = predicate.replaceAll('_', ' ').trim();
  const body = object.trim();
  if (lead.length === 0) {
    if (body.length === 0) return '';
    return asSentence(body);
  }
  const sentenceLead = sentenceCase(lead);
  if (body.length === 0) return `${sentenceLead}.`;

  /*
   * Avoids repeating a predicate's opening verb in the inclusion note. Keep the fuller
   * statement when predicate and object duplicate each other. Match only the first
   * meaning-bearing predicate word: arbitrary shared words such as American do not establish
   * repetition. The underlying claim retains both fields.
   */
  const objectLeadWord = body.match(/^[A-Za-z']+/u)?.[0]?.toLowerCase() ?? '';
  if (objectLeadWord.length > 0 && predicateLeadWord(lead) === objectLeadWord) {
    return asSentence(body.length >= lead.length ? sentenceCase(body) : sentenceLead);
  }

  /*
   * (b) PREFIX RUN INTO A COMPLETE SENTENCE — the bulk of the defect, and the one shape (a) does
   * not reach because the object's verb is not the predicate's:
   *
   *   first_to  + "In 1977, President Carter appointed Young U.S. Ambassador …"
   *              -> "First to In 1977, President Carter appointed Young …"
   *   founded_in + "Washington and a small group opened the Tuskegee Normal …"
   *              -> "Founded in Washington and a small group opened the Tuskegee Normal …"
   *
   * The well-formed notes in this catalog already work by letting the object speak, so that is
   * the rule: when the object is a sentence of its own, drop the predicate and publish the
   * sentence. The predicate is not lost from the RECORD — the claim still renders in full under
   * "what the sources say"; it is lost only from this one-sentence summary, which the object
   * already states.
   *
   * `objectIsSelfStanding` is the whole guard, and it is deliberately asymmetric: it fires only
   * on positive evidence of a verb or a sentence ending, so an object with neither — "National
   * Register of Historic Places", "President John F. Kennedy", "Black heritage and education" —
   * keeps its predicate and still reads as a sentence. Measured on the active release, of the
   * 2,383 capital-initial objects reaching a published basis record it drops the predicate on
   * 1,455 and keeps it on 928, and it keeps it on 559 of the 561 objects of 30 characters or
   * less, which is where the bare noun phrases live.
   */
  if (objectIsSelfStanding(body)) return asSentence(body);

  return asSentence(`${sentenceLead} ${body}`);
}

/**
 * Human-readable inclusion note for one claim-predicate group. Must be specific to this
 * record's claim text — never a dump of `NOTABILITY_RUBRIC` methodology prose (that text is
 * criterion definition for methodology pages, not a per-record reason). Citations stay on
 * `evidenceIds` for the public surface to link; this note does not repeat "Cited from …".
 * BlackStory assembles/cites; it does not originate the historical fact.
 */
export function buildNotabilityBasisNote(
  predicate: string,
  predicateClaims: readonly ReleaseClaimProjection[],
  subjectName?: string,
): string {
  const [sample] = predicateClaims;
  const object = sample?.object ?? '';
  // Some lanes store the subject's own name as the claim object, which this function otherwise
  // renders as a sentence by joining it to the predicate: "Was lynched Gus Roberson." Dropping a
  // self-naming object leaves "Was lynched." — which is the sentence that was meant.
  const subject = subjectName?.trim().toLowerCase();
  const isSelfNaming =
    subject !== undefined && subject.length > 0 ? object.trim().toLowerCase() === subject : false;
  const note = formatClaimInclusionNote(predicate, isSelfNaming ? '' : object);
  const hasCitation = predicateClaims.some((claim) => claim.citationSource.trim().length > 0);
  if (!hasCitation) {
    const stem = note.replace(/[.!?]$/, '');
    return `${stem}. Linked source citation is incomplete.`;
  }
  return note;
}

/**
 * Builds a REAL, evidence-backed `notabilityBasis` from an entry's own claims: one basis record
 * per distinct claim predicate, `evidenceIds` set to the ids of that predicate's claims that
 * carry a non-empty `citationSource`. Every basis record traces back to an actual claim the
 * entry declared, never a placeholder or a fabricated inclusion reason.
 */
export function buildReleaseNotabilityBasis(
  entry: ReleaseSourceEntity,
  claims: readonly ReleaseClaimProjection[] = buildClaimProjections(entry),
): readonly NotabilityBasisRecord[] {
  // A record about a killing states one reason for inclusion: the killing. Its other claims are
  // record content and stay on the record, but "Date June 17, 2015.", "Location 110 Calhoun
  // Street." and "Group Emanuel Nine." are not answers to why Susie Jackson is in this catalog.
  // Same rule as isAccusationPredicate, applied to metadata instead of to an allegation.
  //
  // Guarded on there being a killing predicate to keep, because an event record has none: the
  // Tulsa Race Massacre is a racial-terror record whose claims are `occurred in` and `targeted`,
  // and dropping those would leave it with no basis at all.
  const racialTerrorRecord = isRacialTerrorRecord(entry, claims);

  // A criterion the inference positively identifies. Elmer Jackson's `only_or_oldest` — one of
  // three men lynched in Duluth in 1920, the only widely known lynching in Minnesota — is one of
  // these, and an earlier draft of the metadata rule discarded it along with the date.
  const identifies = (claim: ReleaseClaimProjection): boolean =>
    inferNotabilityCriterionFromClaim(claim.predicate, claim.object, entry.kind) !==
    'documented_site';

  /*
   * Inclusion basis answers why the record belongs in the catalog. Killing records prioritize
   * claims stating the killing. If racial-terror classification lacks a matching killing
   * predicate, retain the available claims rather than dropping the event. Other records use
   * positively identified claims, retaining the residual when none qualifies.
   */
  const racialKillingRecord = !racialTerrorRecord && isRacialKillingRecord(entry, claims);

  /*
   * Include both the broad killing predicates and the stricter racial-terror predicates when
   * selecting basis claims. Neither vocabulary contains the other. This selection does not
   * broaden the separate record-classification rule.
   */
  const statesTheKilling = (claim: ReleaseClaimProjection): boolean =>
    isKillingPredicate(claim.predicate) || isRacialTerrorKillingPredicate(claim.predicate);

  const basisClaims =
    racialTerrorRecord || racialKillingRecord
      ? claims.some(statesTheKilling)
        ? claims.filter((claim) => statesTheKilling(claim) || identifies(claim))
        : claims
      : (() => {
          const identified = claims.filter(identifies);
          return identified.length > 0 ? identified : claims;
        })();

  const byPredicate = new Map<string, ReleaseClaimProjection[]>();
  for (const claim of basisClaims) {
    // An accusation against the subject is not a reason the subject is in the catalog (see
    // isAccusationPredicate). The claim itself is untouched — it stays in `claims`, where the
    // record can carry it in context; it is only barred from becoming an inclusion basis.
    if (isAccusationPredicate(claim.predicate)) continue;
    const bucket = byPredicate.get(claim.predicate);
    if (bucket) {
      bucket.push(claim);
    } else {
      byPredicate.set(claim.predicate, [claim]);
    }
  }

  // For a racial-terror record, replace only the generic documented_site fallback with the
  // supported killing criterion. Preserve positively identified criteria such as landmark
  // designation.
  const fallback: NotabilityCriterion = racialTerrorRecord
    ? 'documented_racial_terror'
    : racialKillingRecord
      ? 'documented_racial_killing'
      : (KIND_FALLBACK[entry.kind] ?? 'documented_site');

  const records: NotabilityBasisRecord[] = [];
  for (const [predicate, predicateClaims] of byPredicate) {
    const evidenceIds = predicateClaims
      .filter((claim) => claim.citationSource.trim().length > 0)
      .map((claim) => claim.id);
    const [sample] = predicateClaims;
    const inferred = sample
      ? inferNotabilityCriterionFromClaim(predicate, sample.object, entry.kind)
      : fallback;
    const criterion = inferred === 'documented_site' ? fallback : inferred;
    records.push({
      criterion,
      note: buildNotabilityBasisNote(predicate, predicateClaims, entry.displayName),
      evidenceIds,
    });
  }
  // Deterministic order: callers (schema validation, snapshot tests) should not see map-iteration
  // order drift between runs.
  return records.sort((a, b) => a.criterion.localeCompare(b.criterion));
}

/**
 * Citation identity for coverage counting: the DOCUMENT a claim rests on, normalized to
 * host + path so `?utm=…`, a `#section` anchor, or a trailing slash cannot make one document
 * look like two. Falls back to the free-text `citationSource` when a claim carries no resolvable
 * href. Returns `null` for an uncited claim, which contributes no coverage.
 *
 * Document granularity, deliberately — the same question `assessLandscapeDepth` asks
 * (`packages/ops-data/scripts/lib/incremental-publish.ts`): "has anyone read anything beyond the
 * index row?" An NRHP nomination form is served by the same publisher as the NRHP index entry but
 * is a different document and real research, so it counts. This is a different granularity from
 * `entity-content-audit.ts`'s `countDistinctSources`, which counts PUBLISHERS because it asks the
 * corroboration question ("do independent publishers agree?") — same corpus, two questions.
 */
function citationDocumentKey(claim: ReleaseClaimProjection): string | null {
  const href = claim.citationHref?.trim() ?? '';
  if (href.length > 0) {
    try {
      const url = new URL(href);
      return `${url.hostname.replace(/^www\./iu, '')}${url.pathname}`
        .toLowerCase()
        .replace(/\/$/u, '');
    } catch {
      // Unparseable href — fall through to the text source rather than inventing a document.
    }
  }
  const source = claim.citationSource.trim();
  return source.length > 0 ? source.toLowerCase() : null;
}

/**
 * Computes coverage once for both projection and search output. Fewer than two distinct cited
 * documents is minimal; two is partial; substantial also requires at least five claims with
 * every claim cited. Recognized template prose caps coverage at minimal. Distinct URLs measure
 * document coverage, not independent lineages or historical completeness.
 */
export function computeReleaseResearchCoverage(
  claims: readonly ReleaseClaimProjection[],
  summary: string,
): ReleaseResearchCoverage {
  if (findTemplateSummarySignature(summary) !== null) return 'minimal';

  const claimCount = claims.length;
  const citedCount = claims.filter((claim) => claim.citationSource.trim().length > 0).length;
  const documentCount = new Set(
    claims.map((claim) => citationDocumentKey(claim)).filter((key): key is string => key !== null),
  ).size;

  if (documentCount < 2) return 'minimal';
  if (claimCount >= 5 && citedCount === claimCount) return 'substantial';
  return 'partial';
}

export type ReferenceResolutionFailure = { readonly ok: false; readonly reason: string };
export type ReferenceResolutionResult = { readonly ok: true } | ReferenceResolutionFailure;

/**
 * Fail-closed structural reference resolution. Refuses entries whose declared topics, evidence,
 * jurisdiction, or location do not resolve to something real:
 *  - topics: every `topicIds` entry must be a member of `TOPIC_REGISTRY` (`isValidTopicId`).
 *  - evidence: every `notabilityBasis[].evidenceIds` entry must match a real claim id this same
 *    entry declared (guards the builder's own output against ever drifting from its claims).
 *  - jurisdiction: `jurisdictionLabel` must be a non-empty, non-whitespace string.
 *  - location: `lat`/`lng` must encode to a real geohash (`buildGeoPointFields` throws on an
 *    out-of-range coordinate) and `locationLabel`/`locationPrecision` must be non-empty.
 *
 * `mentionedEntityIds` is intentionally NOT checked here see this module's header doc comment.
 */
export function resolveReleaseEntityReferences(
  entry: ReleaseSourceEntity,
  claims: readonly ReleaseClaimProjection[],
  notabilityBasis: readonly NotabilityBasisRecord[],
): ReferenceResolutionResult {
  const unresolvedTopics = (entry.topicIds ?? []).filter((id) => !isValidTopicId(id));
  if (unresolvedTopics.length > 0) {
    return {
      ok: false,
      reason: `topicIds do not resolve against TOPIC_REGISTRY: ${unresolvedTopics.join(', ')}`,
    };
  }

  const claimIds = new Set(claims.map((claim) => claim.id));
  const danglingEvidenceIds = notabilityBasis
    .flatMap((basis) => basis.evidenceIds)
    .filter((evidenceId) => !claimIds.has(evidenceId));
  if (danglingEvidenceIds.length > 0) {
    return {
      ok: false,
      reason: `notabilityBasis evidenceIds do not resolve to a claim on this entry: ${danglingEvidenceIds.join(', ')}`,
    };
  }

  if (entry.jurisdictionLabel.trim().length === 0) {
    return {
      ok: false,
      reason: 'jurisdictionLabel does not resolve to a real jurisdiction (empty)',
    };
  }
  if (entry.locationLabel.trim().length === 0) {
    return { ok: false, reason: 'locationLabel does not resolve to a real location (empty)' };
  }
  if (entry.locationPrecision.trim().length === 0) {
    return {
      ok: false,
      reason: 'locationPrecision does not resolve to a real precision level (empty)',
    };
  }
  // The publication precision engine coarsens prohibited precision, living residences and
  // restricted locations. It records precisionReductionReason on the projection rather than
  // silently changing coordinates.

  return { ok: true };
}

const US_STATES_BY_NAME_LENGTH_DESC: readonly (typeof US_STATES)[number][] = [...US_STATES].sort(
  (a, b) => b.name.length - a.name.length,
);

/**
 * Resolves the declared USPS postal code for geo-integrity checks. Prefers an explicit
 * `jurisdictionStateCode`; otherwise parses the trailing segment of `jurisdictionLabel`
 * (2-letter code, D.C., or full state name). Returns an empty string when unresolvable.
 */
export function resolveReleaseEntityStateCode(
  entry: Pick<ReleaseSourceEntity, 'jurisdictionLabel' | 'jurisdictionStateCode'>,
): string {
  if (entry.jurisdictionStateCode !== undefined) {
    return normalizeStateCode(entry.jurisdictionStateCode);
  }

  const label = entry.jurisdictionLabel.trim();
  if (label.length === 0) return '';

  const trailing = (label.split(',').pop() ?? '').trim();
  if (trailing.length === 0) return '';

  if (/^[A-Za-z]{2}$/.test(trailing)) {
    return normalizeStateCode(trailing);
  }
  if (/^D\.?\s*C\.?$/i.test(trailing)) {
    return 'DC';
  }

  const trailingLower = trailing.toLowerCase();
  for (const state of US_STATES_BY_NAME_LENGTH_DESC) {
    if (trailingLower === state.name.toLowerCase()) {
      return state.postalCode;
    }
  }

  return '';
}

function resolveReleaseStateBoundaries(
  context: ReleaseBuildContext,
): StateBoundaryIndex | undefined {
  return context.geoIntegrity?.stateBoundaries ?? context.stateBoundaries;
}

function resolveReleaseGeoIntegrityOptions(
  context: ReleaseBuildContext,
): GeoIntegrityAuditOptions | undefined {
  const toleranceDegrees = context.geoIntegrity?.toleranceDegrees;
  if (toleranceDegrees === undefined) return undefined;
  return { toleranceDegrees };
}

export type ReleaseGeoIntegrityGateResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Pre-check for the release builder: when boundaries are supplied on context, verifies that
 * `lat`/`lng` lie inside the entity's declared state. Uses `evaluateGeoIntegrityPublishGate`;
 * never mutates coordinates or jurisdiction fields.
 */
export function evaluateReleaseGeoIntegrityGate(
  entry: ReleaseSourceEntity,
  context: ReleaseBuildContext,
  lat: number,
  lng: number,
): ReleaseGeoIntegrityGateResult {
  const boundaries = resolveReleaseStateBoundaries(context);
  if (boundaries === undefined) return { ok: true };

  const gateOptions = resolveReleaseGeoIntegrityOptions(context);
  const gate = evaluateGeoIntegrityPublishGate(
    [
      {
        id: entry.id,
        stateCode: resolveReleaseEntityStateCode(entry),
        lat,
        lng,
      },
    ],
    boundaries,
    gateOptions ?? {},
  );
  if (gate.ok) return { ok: true };

  return {
    ok: false,
    message: gate.failures.map((failure) => failure.message).join(' '),
  };
}

function isRelationshipType(value: string): value is RelationshipType {
  return (RELATIONSHIP_TYPES as readonly string[]).includes(value);
}

/** Prefer graph-derived context entries; fall back to catalog bootstrap `entry.related`. */
function resolveRelatedEntries(
  entry: ReleaseSourceEntity,
  context: ReleaseBuildContext,
): readonly PublicRelatedEntry[] {
  if (context.relatedEntries !== undefined) {
    return context.relatedEntries;
  }
  const bootstrap = entry.related ?? [];
  const validated: PublicRelatedEntry[] = [];
  for (const item of bootstrap) {
    if (!isRelationshipType(item.type)) continue;
    if (item.direction !== 'outgoing' && item.direction !== 'incoming') continue;
    validated.push({
      id: item.id,
      type: item.type,
      direction: item.direction,
      ...(item.timespan ? { timespan: item.timespan } : {}),
    });
  }
  return validated;
}

function personPublicStatusFromLiving(
  livingStatus: LivingStatus,
): 'living' | 'deceased' | 'unknown' {
  if (livingStatus === 'deceased') return 'deceased';
  if (livingStatus === 'living') return 'living';
  return 'unknown';
}

function canonicalHasAssertedStatus(
  entry: ReleaseSourceEntity,
  canonical: CanonicalStatusSnapshot | undefined,
): boolean {
  if (!canonical) return false;
  if (entry.kind === 'person') {
    return canonical.livingStatus !== undefined && canonical.livingStatus !== 'not_applicable';
  }
  return (canonical.statusHistory?.length ?? 0) > 0;
}

/**
 * Resolves public projection status fields canonical-first, then entry statusHistory via
 * `currentStatus`, then `deriveCatalogEntityStatus` as heuristic backstop.
 */
export function resolveReleaseProjectionStatus(
  entry: ReleaseSourceEntity,
  canonical: CanonicalStatusSnapshot | undefined,
  /**
   * Distinct-source coverage for this entry, computed just upstream. Passed in rather than
   * recomputed so the heuristic backstop can tell a researched record from a bare registry
   * listing before defaulting a place to `active`.
   */
  researchCoverage?: string,
): ResolvedReleaseProjectionStatus {
  if (canonicalHasAssertedStatus(entry, canonical) && canonical) {
    if (entry.kind === 'person') {
      const livingStatus = canonical.livingStatus as LivingStatus;
      return {
        livingStatus,
        status: personPublicStatusFromLiving(livingStatus),
        statusProvenance: 'canonical',
      };
    }
    const statusHistory = canonical.statusHistory ?? [];
    const status = currentStatus(statusHistory);
    return {
      ...(statusHistory.length > 0 ? { statusHistory } : {}),
      ...(status !== undefined ? { status } : {}),
      statusProvenance: 'canonical',
    };
  }

  if (entry.statusHistory && entry.statusHistory.length > 0 && entry.kind !== 'person') {
    const statusHistory = entry.statusHistory as readonly StatusHistoryEntry<EntityStatusValue>[];
    const status = currentStatus(statusHistory) ?? entry.status;
    return {
      statusHistory,
      ...(status !== undefined
        ? { status: status as EntityStatusValue | 'living' | 'deceased' | 'unknown' }
        : {}),
      statusProvenance: 'derived_heuristic',
    };
  }

  const derived = deriveCatalogEntityStatus({
    id: entry.id,
    kind: entry.kind,
    displayName: entry.displayName,
    summary: entry.summary,
    ...(entry.historicalContext !== undefined
      ? { historicalContext: entry.historicalContext }
      : {}),
    ...(entry.impactStatement !== undefined ? { impactStatement: entry.impactStatement } : {}),
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
    ...(researchCoverage !== undefined ? { researchCoverage } : {}),
    ...(entry.claims !== undefined ? { claims: entry.claims } : {}),
    ...(entry.statusHistory !== undefined ? { statusHistory: entry.statusHistory as never } : {}),
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.livingStatus !== undefined ? { livingStatus: entry.livingStatus } : {}),
  });

  return {
    ...(derived.status !== undefined
      ? {
          status: derived.status as
            EntityStatusValue | 'living' | 'deceased' | 'unknown' | 'presumed_deceased',
        }
      : {}),
    ...(derived.statusHistory !== undefined ? { statusHistory: derived.statusHistory } : {}),
    ...(derived.livingStatus !== undefined
      ? { livingStatus: derived.livingStatus as LivingStatus }
      : {}),
    statusProvenance: 'derived_heuristic',
  };
}

/** Ensures empty related is always an array, never a legacy `{}` object. */
export function normalizeReleaseRelated(
  related: readonly PublicRelatedEntry[] | undefined,
): readonly PublicRelatedEntry[] {
  return related ?? [];
}

/**
 * Ensures claims is an array at the write boundary so array consumers cannot receive an
 * object-shaped value.
 */
export function normalizeReleaseClaims(
  claims: readonly ReleaseClaimProjection[] | undefined,
): readonly ReleaseClaimProjection[] {
  return Array.isArray(claims) ? claims : [];
}

/**
 * Build entity and search projections together from the same reviewed claims, inclusion basis
 * and coverage. Return a failure for expected content/reference gaps and optionally check
 * declared geography against supplied boundaries. Invalid coordinate ranges throw and must be
 * handled per entity by the caller.
 */
export function buildReleaseEntityArtifacts(
  entry: ReleaseSourceEntity,
  context: ReleaseBuildContext,
): ReleaseBuildResult {
  if (context.catalogDecision?.action === 'flag_for_retraction') {
    return {
      ok: false,
      reason: 'catalog_decision_retracted',
      message: `Admin flagged this entity for retraction: ${context.catalogDecision.reason}`,
    };
  }

  const claims = buildClaimProjections(entry);

  const factGate = evaluateFactPublishGate({
    status: 'published',
    citations: claims.map((claim) => claimToFactCitationStandIn(claim)),
  });
  if (!factGate.ok && factGate.reason === 'no_citations') {
    return { ok: false, reason: 'no_citations', message: factGate.message };
  }

  const notabilityBasis = buildReleaseNotabilityBasis(entry, claims);
  const notabilityGate = evaluateNotabilityGate(notabilityBasis);
  if (!notabilityGate.passed) {
    return { ok: false, reason: 'notability_basis_gate', message: notabilityGate.reason };
  }
  const basisWithoutEvidence = notabilityBasis.find((basis) => basis.evidenceIds.length === 0);
  if (basisWithoutEvidence) {
    return {
      ok: false,
      reason: 'notability_basis_gate',
      message:
        `notabilityBasis record "${basisWithoutEvidence.criterion}" has zero resolvable ` +
        'evidence refs (no claims with a non-empty citationSource for that predicate).',
    };
  }

  const referenceResolution = resolveReleaseEntityReferences(entry, claims, notabilityBasis);
  if (!referenceResolution.ok) {
    return { ok: false, reason: 'reference_resolution', message: referenceResolution.reason };
  }

  const researchCoverage = computeReleaseResearchCoverage(claims, entry.summary);
  const geohashPrecision = context.geohashPrecision ?? 5;
  const lat = context.locationOverride?.lat ?? entry.lat;
  const lng = context.locationOverride?.lng ?? entry.lng;

  const geoIntegrityGate = evaluateReleaseGeoIntegrityGate(entry, context, lat, lng);
  if (!geoIntegrityGate.ok) {
    return {
      ok: false,
      reason: 'geo_integrity_gate',
      message: geoIntegrityGate.message,
    };
  }

  const locationPrecision = context.locationOverride?.precision ?? entry.locationPrecision;
  const locationLabel = context.locationOverride?.locationLabel ?? entry.locationLabel;
  const matchMethod = context.locationOverride?.matchMethod ?? 'manual_research';
  const geo: GeoPointFields = buildGeoPointFields(lat, lng, geohashPrecision);
  const notabilityLabels = [
    ...new Set(notabilityBasis.map((basis) => NOTABILITY_RUBRIC[basis.criterion])),
  ];
  const related = normalizeReleaseRelated(resolveRelatedEntries(entry, context));
  const resolvedStatus = resolveReleaseProjectionStatus(
    entry,
    context.canonicalStatus,
    researchCoverage,
  );
  const publicStatus = resolvedStatus.status;
  const publicStatusHistory = resolvedStatus.statusHistory;
  const resolvedLivingStatus = resolvedStatus.livingStatus ?? entry.livingStatus;
  const visit = publicVisitForTier(
    context.visitOverride ?? entry.visit,
    locationPrecision,
    entry.kind,
    resolvedLivingStatus,
  );
  /*
   * The ONE engine on the publish path (`docs/security/location-precision-standard.md` §4):
   * every entity's raw/authored precision is normalized onto the controlled public tier list
   * and reduced per the standard's §3 conditions (living-residence, restricted/sensitive site,
   * withheld-on-request, ...) right here, so nothing downstream re-derives or re-decides this.
   * The reduced tier and its reason (when any rule fired) are both written onto the projection.
   */
  const precisionReduction = reducePublicPrecision({
    precision: locationPrecision,
    kind: entry.kind,
    ...(resolvedStatus.livingStatus !== undefined
      ? { livingStatus: resolvedStatus.livingStatus }
      : {}),
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
  });
  const publicLocationPrecision = precisionReduction.precision;
  /*
   * A reduced tier must reduce the point too, or the label would say "city" over a rooftop
   * coordinate. `redactLocationForPublic` coarsens lat/lng to the tier's decimals and trims
   * the geohash to the tier's length (standard §2); an unreduced tier passes through untouched.
   * A location withheld entirely ('none') keeps only a whole-degree point so the projection
   * still validates while saying nothing sharper than the country.
   */
  const publicPoint = precisionReduction.reduced
    ? redactLocationForPublic({
        precision: locationPrecision,
        kind: entry.kind,
        lat: geo.lat,
        lng: geo.lng,
        geohash: geo.geohash,
        ...(resolvedStatus.livingStatus !== undefined
          ? { livingStatus: resolvedStatus.livingStatus }
          : {}),
        ...(entry.sensitivityClass !== undefined
          ? { sensitivityClass: entry.sensitivityClass }
          : {}),
      })
    : undefined;
  const publicGeo: GeoPointFields = precisionReduction.reduced
    ? buildGeoPointFields(
        publicPoint?.lat ?? Math.round(geo.lat),
        publicPoint?.lng ?? Math.round(geo.lng),
        Math.min(geohashPrecision, publicPoint?.geohash?.length ?? 1),
      )
    : geo;
  /*
   * Derive era once, here, so the entity projection and the search index cannot disagree.
   * Previously both copied `entry.eraBuckets` verbatim; catalog entries that carry only a dated
   * `statusHistory` shipped with no era at all, and the web read path patched the entity page
   * while the search index kept an empty era facet. Screening designation dates is the whole
   * reason this goes through `resolveEraBucketsFromEvidence` rather than `deriveEraBuckets`.
   */
  const eraBuckets = resolveEraBucketsFromEvidence({
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
    ...(publicStatusHistory !== undefined ? { statusHistory: publicStatusHistory } : {}),
    claims,
  });

  const projection: ReleaseEntityProjectionFields = {
    id: entry.id,
    releaseId: context.releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    summary: entry.summary,
    location: {
      lat: publicGeo.lat,
      lng: publicGeo.lng,
      geohash: publicGeo.geohash,
      geohashPrefixes: publicGeo.geohashPrefixes,
      precision: publicLocationPrecision,
      matchMethod,
      ...(precisionReduction.reason !== undefined
        ? { precisionReductionReason: precisionReduction.reason }
        : {}),
    },
    claimIds: claims.map((claim) => claim.id),
    claims,
    jurisdictionLabel: entry.jurisdictionLabel,
    locationLabel,
    ...(visit !== undefined ? { visit } : {}),
    ...(publicStatus !== undefined ? { status: publicStatus } : {}),
    ...(publicStatusHistory !== undefined && publicStatusHistory.length > 0
      ? { statusHistory: publicStatusHistory }
      : {}),
    ...(resolvedStatus.livingStatus !== undefined
      ? { livingStatus: resolvedStatus.livingStatus }
      : {}),
    ...(resolvedStatus.statusProvenance !== undefined
      ? { statusProvenance: resolvedStatus.statusProvenance }
      : {}),
    ...(eraBuckets.length > 0 ? { eraBuckets } : {}),
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    topicTags: entry.topicTags ?? [],
    topicIds: entry.topicIds ?? [],
    mentionedEntityIds: entry.mentionedEntityIds ?? [],
    keywords: entry.keywords ?? [],
    notabilityLabels,
    notabilityBasis,
    researchCoverage,
    ...(entry.historicalContext !== undefined
      ? { historicalContext: entry.historicalContext }
      : {}),
    ...(entry.impactStatement !== undefined ? { impactStatement: entry.impactStatement } : {}),
    ...(related.length > 0 ? { related } : {}),
    generatedAt: context.generatedAt,
    recordUpdatedAt: context.generatedAt,
  };

  const searchIndex: ReleaseSearchIndexFields = {
    id: entry.id,
    releaseId: context.releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    aliases: [],
    summary: sanitizePublicProseText(entry.summary),
    topicTags: entry.topicTags ?? [],
    topicIds: entry.topicIds ?? [],
    mentionedEntityIds: entry.mentionedEntityIds ?? [],
    keywords: entry.keywords ?? [],
    jurisdictionState: entry.jurisdictionLabel,
    ...(publicStatus !== undefined ? { status: publicStatus } : {}),
    eraBuckets,
    notabilityBasis,
    notabilityLabels,
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage,
    relatedCount: related.length,
    claimCount: claims.length,
    evidenceInputs: recordEvidenceInputs(claims),
  };

  return { ok: true, projection, searchIndex };
}

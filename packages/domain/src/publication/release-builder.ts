/**
 * Single deterministic per-entity release/projection builder (the related workstream).
 *
 * `./index.ts` already owns release-level infrastructure (manifest hashing, signing, lifecycle
 * transitions). This module owns the CONTENT of one entity's release artifacts — the piece that
 * was previously duplicated, thinned-out logic living inline in
 * `packages/ops-data/scripts/publish-national-catalog.ts`. That script is today's only writer of
 * `publicReleases/{releaseId}/entities/{id}` + `publicSearchIndex/{id}` docs, and it works from a
 * `CatalogEntry` fixture shape (see that script's header) rather than the richer
 * `CanonicalEntityDoc`/`CanonicalClaimDoc` model — so `ReleaseSourceEntity` below intentionally
 * mirrors `CatalogEntry`'s shape, generalized so it carries no dependency on `@repo/ops-data`'s
 * Zod schemas (this package must not depend on that package). When a canonical-graph release
 * builder replaces the fixture-driven one, adapt a `CanonicalEntityDoc` into this same
 * `ReleaseSourceEntity` shape rather than writing a second builder.
 *
 * What this module makes REAL instead of fabricated (see each function's doc comment):
 *  - `notabilityBasis`: derived from the entry's own claims (one basis record per distinct claim
 *    predicate, `evidenceIds` pointing at that predicate's claim ids), not a single hardcoded
 *    placeholder string.
 *  - `researchCoverage`: derived from the number of distinct SOURCE DOCUMENTS the entry's claims
 *    rest on, not a UI-side guess and not duplicated ad hoc between the projection and
 *    search-index builders. Counting claims instead measured how finely a publish path chose to
 *    slice one source — see `computeReleaseResearchCoverage` and repo-z1pw.
 *  - `generatedAt`/`recordUpdatedAt`: a real "this publish happened at this instant" timestamp,
 *    legitimate at release-BUILD time (unlike the web read-path, which must never fabricate one
 *    at render time — see `apps/web/src/lib/public-data/map-projection.ts`).
 *
 * Fail-closed reference resolution (`resolveReleaseEntityReferences`): refuses to build artifacts
 * for an entry whose declared topics/jurisdiction/location/evidence do not resolve to something
 * real. `mentionedEntityIds` is deliberately NOT checked here: per `publicEntityProjectionSchema`'s
 * own doc comment these may still be raw legacy-tag placeholder strings pending the related workstream's
 * real entity-resolution work, so treating them as fail-closed today would reject legitimate,
 * already-reviewed records for a gap this bead does not own.
 *
 * Opt-in geo-integrity (`evaluateReleaseGeoIntegrityGate`): when `ReleaseBuildContext` supplies
 * `geoIntegrity.stateBoundaries` (or shorthand `stateBoundaries`), declared state vs coordinates
 * is checked via `evaluateGeoIntegrityPublishGate` before artifacts are emitted. Omitted boundaries
 * preserve backward-compatible fixture behavior. Mismatch fails closed; lat/lng/state are never
 * auto-rewritten.
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

export type ReleaseSourceClaim = {
  readonly id?: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
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
   * `bb_canonical.entity_visit` + `entity_locations.street`/`postal_code` for a canonical
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
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
};

export type ReleaseResearchCoverage = 'minimal' | 'partial' | 'substantial';

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
  readonly locationOverride?: {
    readonly lat: number;
    readonly lng: number;
    readonly precision?: string;
    readonly matchMethod?: string;
    readonly locationLabel?: string;
  };
  /**
   * Canonical visit-contact input (`bb_canonical.entity_visit` joined with
   * `entity_locations.street`/`postal_code`), when the caller looked one up. Wins over
   * `entry.visit` — same precedence as `locationOverride` above. Gated through
   * `publicVisitForTier` before it reaches the projection; this is raw input, not the
   * already-filtered public shape.
   */
  readonly visitOverride?: PublicVisit;
  /**
   * Latest admin bulk catalog decision for this entity (apps/admin's catalog-decisions-store),
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
   * Authoritative lifecycle status from `bb_canonical.entities`. When present for an entity,
   * canonical values win over heuristic derivation from summary text.
   */
  readonly canonicalStatus?: CanonicalStatusSnapshot;
};

/** Where release projection status fields were resolved. */
export type StatusProvenance = 'canonical' | 'derived_heuristic';

/** Canonical lifecycle fields loaded at publish time (subset of bb_canonical.entities). */
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
    /** Set only when `reducePublicPrecision` (the location precision standard's one publish-path
     * engine, repo-wqcn) actually coarsened this entity's precision see §3 of the standard for
     * the reason vocabulary. Absent means the location published at its source precision. */
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

/** Highest accepted-claim confidence on a record. Letter grades derive at read time; never invent grade from claim count. */
export type ReleaseConfidenceTier = 'high' | 'medium' | 'low' | 'unrated';

/**
 * Max claim confidence for search_index / Records evidence floors.
 * Matches Atlas `highestConfidence`: one high claim is A-band even when other claims are low.
 */
export function highestClaimConfidenceTier(
  claims: readonly { readonly confidenceLevel?: string }[],
): ReleaseConfidenceTier {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

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
  /** Highest claim confidence — evidence floor input for Records slim; not a public ranking score. */
  readonly confidenceTier: ReleaseConfidenceTier;
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
  return (entry.claims ?? []).map((claim, index) => ({
    id: resolveReleaseClaimId(entry, claim, index),
    predicate: claim.predicate,
    object: sanitizePublicProseText(claim.object),
    confidenceLevel: claim.confidenceLevel,
    citationSource: claim.citationSource,
    ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
    citationLabel: claim.citationLabel,
    // Pass through scored lineage only. Inventing `1` per cited claim overcounts the same
    // source across claims; the web evidence panel uses unique citation sources as proxy.
    ...(claim.independentLineageCount !== undefined
      ? { independentLineageCount: claim.independentLineageCount }
      : {}),
  }));
}

function claimToFactCitationStandIn(claim: ReleaseSourceClaim): FactCitation {
  // Minimal structural stand-in sufficient to express "a citation exists" for the no_citations
  // floor check. The fuller completeness sub-check (archived-capture pointer, retrieval date) is
  // a genuine pipeline-wide data gap (see publish-national-catalog.ts's wiring-note history,
  // the related workstream) — not fabricated here, deliberately not enforced yet.
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
 * register", "hall of fame", "only"/"oldest"); every other claim honestly falls back to
 * `documented_site` the broadest criterion that is always true of every record in this catalog
 * (each is, by construction, a documented site/entity in the active public release) rather than
 * inventing a more specific rubric match the source text doesn't support.
 */
export function inferNotabilityCriterionFromClaim(
  predicate: string,
  object: string,
): NotabilityCriterion {
  const text = `${predicate} ${object}`.toLowerCase();
  if (/\bfirst\b/.test(text)) return 'first_to_do_x';
  if (/national register|national historic landmark|\blandmark\b/.test(text)) {
    return 'landmark_or_national_register';
  }
  if (/hall of fame|pulitzer|congressional gold medal|national medal/.test(text)) {
    return 'major_honor_or_hall_of_fame';
  }
  if (/\bonly\b|\boldest\b/.test(text)) return 'only_or_oldest';
  if (/precedent|supreme court|ruled|struck down|upheld/.test(text)) return 'court_precedent';
  return 'documented_site';
}

/** True when `criterion` is a member of the closed `NotabilityCriterion` enum this domain
 * package defines (defensive check the builder's own inference function only ever returns a
 * member of `NOTABILITY_CRITERIA`, but callers passing external strings should validate too). */
export function isNotabilityCriterion(value: string): value is NotabilityCriterion {
  return (NOTABILITY_CRITERIA as readonly string[]).includes(value);
}

/**
 * Turns a claim predicate + object into one inclusion-evidence sentence.
 * Predicates are snake_case catalog keys (`served_as`, `bombed_on`); objects are usually
 * lowercase continuations authored to follow those keys. Sentence-case the predicate and join
 * without a colon so public copy reads as prose, not a field dump. Source names belong in the
 * citation list (evidenceIds), not inline in the note.
 */
export function formatClaimInclusionNote(predicate: string, object: string): string {
  const lead = predicate.replaceAll('_', ' ').trim();
  const body = object.trim();
  if (lead.length === 0) {
    if (body.length === 0) return '';
    return /[.!?]$/.test(body) ? body : `${body}.`;
  }
  const sentenceLead = `${lead.charAt(0).toUpperCase()}${lead.slice(1)}`;
  if (body.length === 0) return `${sentenceLead}.`;
  const sentence = `${sentenceLead} ${body}`;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
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
): string {
  const [sample] = predicateClaims;
  const note = formatClaimInclusionNote(predicate, sample?.object ?? '');
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
 * carry a non-empty `citationSource`. This replaces the single hardcoded placeholder basis record
 * the fixture publish path used before this bead — every basis record here traces back to an
 * actual claim the entry declared, never a fabricated inclusion reason.
 */
export function buildReleaseNotabilityBasis(
  entry: ReleaseSourceEntity,
  claims: readonly ReleaseClaimProjection[] = buildClaimProjections(entry),
): readonly NotabilityBasisRecord[] {
  const byPredicate = new Map<string, ReleaseClaimProjection[]>();
  for (const claim of claims) {
    const bucket = byPredicate.get(claim.predicate);
    if (bucket) {
      bucket.push(claim);
    } else {
      byPredicate.set(claim.predicate, [claim]);
    }
  }

  const records: NotabilityBasisRecord[] = [];
  for (const [predicate, predicateClaims] of byPredicate) {
    const evidenceIds = predicateClaims
      .filter((claim) => claim.citationSource.trim().length > 0)
      .map((claim) => claim.id);
    const [sample] = predicateClaims;
    const criterion = sample
      ? inferNotabilityCriterionFromClaim(predicate, sample.object)
      : 'documented_site';
    records.push({
      criterion,
      note: buildNotabilityBasisNote(predicate, predicateClaims),
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
 * Derives `researchCoverage` from how many distinct SOURCE DOCUMENTS an entry's claims rest on
 * never a UI-side guess, and computed exactly ONCE here so the projection and search-index
 * builders below always agree.
 *
 * repo-z1pw: this counted CLAIMS before (`claimCount >= 2 -> 'partial'`), which measured how many
 * assertions a publish path chose to split a source into, not how much documentation backs the
 * record. The nrhp-black-heritage lane synthesizes exactly two claims — a listing fact and a
 * significance fact — from one registry index row, both citing that row's own URL. 2,436 live
 * records built from a single spreadsheet line therefore published as 'partial', and because
 * `isThinRecord()` (apps/web) keys strictly on 'minimal', the registry-listing disclosure never
 * fired for the population it was written for. A reader saw an uncaveated description and
 * reasonably concluded it was the whole of the recorded history.
 *
 * Reasoning (documented, not a scoring formula): coverage answers "how much documentation stands
 * behind this record", so the unit is the document.
 *  - `minimal`     — fewer than two distinct cited documents. One document, however many claims
 *                    were carved out of it, is one document.
 *  - `partial`     — two or more distinct cited documents.
 *  - `substantial` — two or more distinct documents AND a meaningfully sized claim set (>=5) AND
 *                    every one of those claims carrying a citation (the pre-existing
 *                    completeness requirement, unchanged).
 *
 * repo-vymq: the document count above is necessary but not sufficient, because it measures the
 * claims and never looks at the prose those claims are supposed to support. A roster importer
 * templates its summary from index fields BY CONSTRUCTION and can still accumulate two cited
 * documents — a corroborating catalog page, a second registry URL — at which point a record whose
 * description nobody researched would publish as 'partial'. `summary` is therefore a required
 * argument, not an optional refinement: a registered template fingerprint caps coverage at
 * 'minimal' regardless of how the claim set scores. Required rather than optional so that adding
 * a new call site is a compile error instead of a silently uncapped publish path — the last
 * version of this guard was bypassed exactly that way.
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
  // repo-wqcn — location precision is no longer a publish-time REJECTION gate. A prohibited
  // raw level, a living person's own residence, a restricted site, etc. all still reach the
  // public projection they are COARSENED there by `reducePublicPrecision` (the one engine on
  // the publish path, `docs/security/location-precision-standard.md` §4), with the reason
  // recorded on `projection.location.precisionReductionReason`, never silently. See
  // `buildReleaseEntityArtifacts` below for where that engine actually runs.

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
 * Ensures claims is always an array at the write boundary, never a legacy `{}` object
 * (repo-n7p6.14: four seed rows reached bb_public.release_entities with `claims: {}`, which
 * jsonb_array_length/.map consumers can't handle). buildClaimProjections already always returns
 * an array, so this only guards a write path that bypasses it — same shape as
 * normalizeReleaseRelated above.
 */
export function normalizeReleaseClaims(
  claims: readonly ReleaseClaimProjection[] | undefined,
): readonly ReleaseClaimProjection[] {
  return Array.isArray(claims) ? claims : [];
}

/**
 * The single deterministic release/projection builder (the related workstream). Given one source entry,
 * produces BOTH the entity-projection fields and the search-index fields from the same claims,
 * notabilityBasis, and researchCoverage never two independently-recomputed copies. Fails closed
 * (returns `{ok: false}`, never throws for an expected data-shape gap) when:
 *  - the entry has zero claims (`evaluateFactPublishGate`'s `no_citations` floor),
 *  - the derived `notabilityBasis` fails `evaluateNotabilityGate` or contains a basis record with
 *    zero resolvable evidence, or
 *  - `resolveReleaseEntityReferences` rejects a dangling topic/evidence/jurisdiction/location
 *    reference, or
 *  - opt-in `evaluateReleaseGeoIntegrityGate` rejects a declared-state vs coordinate mismatch
 *    when `geoIntegrity.stateBoundaries` / `stateBoundaries` is supplied on context.
 * An out-of-range lat/lng throws (via `buildGeoPointFields`) rather than returning `{ok:false}`
 * this mirrors the pre-existing behavior callers already handle as a thrown, per-entity failure.
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
   * every entity's raw/authored precision is normalised onto the controlled public tier list
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
    confidenceTier: highestClaimConfidenceTier(claims),
  };

  return { ok: true, projection, searchIndex };
}

/**
 * Single deterministic per-entity release/projection builder (the related workstream).
 *
 * `./index.ts` already owns release-level infrastructure (manifest hashing, signing, lifecycle
 * transitions). This module owns the CONTENT of one entity's release artifacts — the piece that
 * was previously duplicated, thinned-out logic living inline in
 * `packages/firebase/scripts/publish-national-catalog.ts`. That script is today's only writer of
 * `publicReleases/{releaseId}/entities/{id}` + `publicSearchIndex/{id}` docs, and it works from a
 * `CatalogEntry` fixture shape (see that script's header) rather than the richer
 * `CanonicalEntityDoc`/`CanonicalClaimDoc` model — so `ReleaseSourceEntity` below intentionally
 * mirrors `CatalogEntry`'s shape, generalized so it carries no dependency on `@repo/firebase`'s
 * Zod schemas (this package must not depend on that package). When a canonical-graph release
 * builder replaces the fixture-driven one, adapt a `CanonicalEntityDoc` into this same
 * `ReleaseSourceEntity` shape rather than writing a second builder.
 *
 * What this module makes REAL instead of fabricated (see each function's doc comment):
 *  - `notabilityBasis`: derived from the entry's own claims (one basis record per distinct claim
 *    predicate, `evidenceIds` pointing at that predicate's claim ids), not a single hardcoded
 *    placeholder string.
 *  - `researchCoverage`: derived from actual claim count + citation completeness, not a UI-side
 *    guess and not duplicated ad hoc between the projection and search-index builders.
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
  type NotabilityBasisRecord,
  type NotabilityCriterion,
} from '../entity-status.js';
import { deriveCatalogEntityStatus } from '../derive-catalog-status.js';
import { sanitizePublicProseText } from '../editorial/prose-links.js';
import { evaluateNotabilityGate } from '../relevance/notability-gate.js';
import { evaluateFactPublishGate } from '../facts/publish-gate.js';
import type { FactCitation } from '../facts/citation.js';
import { isValidTopicId } from '../taxonomy/topics.js';
import { buildGeoPointFields, type GeoPointFields } from '../geography/geohash.js';
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
  };
  readonly claimIds: readonly string[];
  readonly claims: readonly ReleaseClaimProjection[];
  readonly jurisdictionLabel: string;
  readonly locationLabel: string;
  readonly status?: string;
  /** Time-scoped lifecycle designations that back `status`. Present when derived or authored. */
  readonly statusHistory?: readonly {
    readonly status: string;
    readonly validFrom?: string;
    readonly validTo?: string | null;
    readonly datePrecision: string;
    readonly basisClaimIds: readonly string[];
  }[];
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
  /** Typed related entries from graph adjacency (or catalog bootstrap fallback). */
  readonly related?: readonly PublicRelatedEntry[];
  /** Real release-build-time timestamps (see module doc comment). */
  readonly generatedAt: string;
  readonly recordUpdatedAt: string;
};

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
 * Derives `researchCoverage` from the entry's real claim count and citation-completeness ratio
 * never a UI-side guess, and computed exactly ONCE here so the projection and search-index
 * builders below always agree.
 *
 * Reasoning (documented, not a scoring formula): `substantial` requires both a meaningfully sized
 * claim set (>=5) AND every one of those claims carrying a resolvable citation; `partial` only
 * requires >=2 claims (matching the pre-existing threshold this replaces, see git history of
 * `publish-national-catalog.ts`'s old `toSearchDoc`); everything else, `minimal`.
 */
export function computeReleaseResearchCoverage(
  claims: readonly ReleaseClaimProjection[],
): ReleaseResearchCoverage {
  const claimCount = claims.length;
  const citedCount = claims.filter((claim) => claim.citationSource.trim().length > 0).length;
  if (claimCount >= 5 && citedCount === claimCount) return 'substantial';
  if (claimCount >= 2) return 'partial';
  return 'minimal';
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

function resolveReleaseStateBoundaries(context: ReleaseBuildContext): StateBoundaryIndex | undefined {
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
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

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

  const researchCoverage = computeReleaseResearchCoverage(claims);
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
  const related = resolveRelatedEntries(entry, context);
  const derivedStatus = deriveCatalogEntityStatus({
    id: entry.id,
    kind: entry.kind,
    displayName: entry.displayName,
    summary: entry.summary,
    ...(entry.historicalContext !== undefined
      ? { historicalContext: entry.historicalContext }
      : {}),
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
    ...(entry.claims !== undefined ? { claims: entry.claims } : {}),
    ...(entry.statusHistory !== undefined ? { statusHistory: entry.statusHistory as never } : {}),
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.livingStatus !== undefined ? { livingStatus: entry.livingStatus } : {}),
  });
  const publicStatus = derivedStatus.status ?? entry.status;
  const publicStatusHistory = derivedStatus.statusHistory;

  const projection: ReleaseEntityProjectionFields = {
    id: entry.id,
    releaseId: context.releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    summary: entry.summary,
    location: {
      lat: geo.lat,
      lng: geo.lng,
      geohash: geo.geohash,
      geohashPrefixes: geo.geohashPrefixes,
      precision: locationPrecision,
      matchMethod,
    },
    claimIds: claims.map((claim) => claim.id),
    claims,
    jurisdictionLabel: entry.jurisdictionLabel,
    locationLabel,
    ...(publicStatus !== undefined ? { status: publicStatus } : {}),
    ...(publicStatusHistory !== undefined && publicStatusHistory.length > 0
      ? { statusHistory: publicStatusHistory }
      : {}),
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
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
    eraBuckets: entry.eraBuckets ?? [],
    notabilityBasis,
    notabilityLabels,
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage,
    relatedCount: related.length,
    claimCount: claims.length,
  };

  return { ok: true, projection, searchIndex };
}

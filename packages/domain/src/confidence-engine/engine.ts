/**
 * Versioned confidence orchestration built on the deterministic scorer.
 * Records input fingerprints, component versions, recalculation causes, and public-language gates.
 */
import { createHash } from 'node:crypto';
import {
  evaluateProceduralLanguage,
  loadProductConstitution,
  type ProductConstitution,
} from '@repo/schemas';
import {
  calculateClaimConfidence,
  CONFIDENCE_COMPONENT_WEIGHTS,
  type ClaimEvidenceLink,
  type ConfidenceEngineInput,
  type ConfidenceEngineResult,
} from '../claims/index.js';

export const CONFIDENCE_ENGINE_VERSION = 'confidence-engine.v1' as const;
export const CONFIDENCE_COMPONENT_VERSION = 'confidence-components.v1' as const;
export const CONFIDENCE_AUDIT_VERSION = 'confidence-audit.v1' as const;

export type ConfidenceInputKind = 'source' | 'evidence' | 'contradiction' | 'policy';

export type ConfidenceInputFingerprints = Readonly<Record<ConfidenceInputKind, string>>;

export type ConfidenceComponentVersions = {
  readonly sourceAuthority: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly directness: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly lineageIndependence: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly temporalProximity: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly geographicPrecision: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly entityMatchQuality: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly extractionQuality: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly contradictionPenalty: typeof CONFIDENCE_COMPONENT_VERSION;
  readonly threshold: 'constitution-policy.v1';
};

export type ConfidenceAudit = {
  readonly auditVersion: typeof CONFIDENCE_AUDIT_VERSION;
  readonly engineVersion: typeof CONFIDENCE_ENGINE_VERSION;
  readonly componentVersions: ConfidenceComponentVersions;
  readonly componentWeights: typeof CONFIDENCE_COMPONENT_WEIGHTS;
  readonly inputFingerprints: ConfidenceInputFingerprints;
  readonly recalculationReasons: readonly ConfidenceInputKind[];
};

export type AuditedConfidenceResult = ConfidenceEngineResult & {
  readonly audit: ConfidenceAudit;
};

export type RecalculateConfidenceInput = ConfidenceEngineInput & {
  readonly previous?: Pick<AuditedConfidenceResult, 'audit'>;
};

export type PublicLanguageEvaluation = {
  readonly allowed: boolean;
  readonly requestedProceduralStatus: string;
  readonly evidenceProceduralStatus: string;
  readonly effectiveProceduralStatus: string;
  readonly proceduralStatusRecognized: boolean;
  readonly violations: readonly string[];
  readonly policyVersion: string;
};

const COMPONENT_VERSIONS: ConfidenceComponentVersions = {
  sourceAuthority: CONFIDENCE_COMPONENT_VERSION,
  directness: CONFIDENCE_COMPONENT_VERSION,
  lineageIndependence: CONFIDENCE_COMPONENT_VERSION,
  temporalProximity: CONFIDENCE_COMPONENT_VERSION,
  geographicPrecision: CONFIDENCE_COMPONENT_VERSION,
  entityMatchQuality: CONFIDENCE_COMPONENT_VERSION,
  extractionQuality: CONFIDENCE_COMPONENT_VERSION,
  contradictionPenalty: CONFIDENCE_COMPONENT_VERSION,
  threshold: 'constitution-policy.v1',
};

const CRIMINAL_PROCEDURAL_STRENGTH: Readonly<Record<string, number>> = {
  unknown_procedural: 0,
  alleged: 1,
  charged: 2,
  indicted: 3,
  arraigned: 3,
  convicted: 4,
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function sortedLinks(links: readonly ClaimEvidenceLink[]): ClaimEvidenceLink[] {
  return [...links].sort(
    (left, right) =>
      left.lineageRootId.localeCompare(right.lineageRootId) ||
      left.evidenceId.localeCompare(right.evidenceId) ||
      left.id.localeCompare(right.id),
  );
}

export function confidenceInputFingerprints(
  links: readonly ClaimEvidenceLink[],
  policy: ProductConstitution,
): ConfidenceInputFingerprints {
  const ordered = sortedLinks(links);
  return {
    source: fingerprint(
      ordered.map(({ evidenceId, lineageRootId, sourceClassification, credible }) => ({
        credible,
        evidenceId,
        lineageRootId,
        sourceClassification,
      })),
    ),
    evidence: fingerprint(
      ordered.map(
        ({
          id,
          claimId,
          claimVersionId,
          evidenceId,
          role,
          lineageRootId,
          credible,
          directness,
          temporalProximity,
          geographicPrecision,
          entityMatchQuality,
          extractionQuality,
          assertedValue,
        }) => ({
          id,
          claimId,
          claimVersionId,
          evidenceId,
          role,
          lineageRootId,
          credible,
          directness,
          temporalProximity,
          geographicPrecision,
          entityMatchQuality,
          extractionQuality,
          ...(assertedValue !== undefined ? { assertedValue } : {}),
        }),
      ),
    ),
    contradiction: fingerprint(
      ordered
        .filter((link) => link.role === 'contradicting')
        .map(({ evidenceId, lineageRootId, credible, assertedValue }) => ({
          evidenceId,
          lineageRootId,
          credible,
          ...(assertedValue !== undefined ? { assertedValue } : {}),
        })),
    ),
    policy: fingerprint(policy),
  };
}

function changedInputs(
  current: ConfidenceInputFingerprints,
  previous?: ConfidenceInputFingerprints,
): ConfidenceInputKind[] {
  const kinds: readonly ConfidenceInputKind[] = ['source', 'evidence', 'contradiction', 'policy'];
  if (!previous) return [...kinds];
  return kinds.filter((kind) => current[kind] !== previous[kind]);
}

function isProceduralStatusSupported(requested: string, evidence: string): boolean {
  if (requested === evidence || requested === 'unknown_procedural') return true;
  const requestedStrength = CRIMINAL_PROCEDURAL_STRENGTH[requested];
  const evidenceStrength = CRIMINAL_PROCEDURAL_STRENGTH[evidence];
  return (
    requestedStrength !== undefined &&
    evidenceStrength !== undefined &&
    requestedStrength <= evidenceStrength
  );
}

/**
 * Recalculate confidence from current inputs and retain why the audit changed.
 * Timestamps are supplied by callers so identical inputs can produce byte-stable records.
 */
export function recalculateConfidence(input: RecalculateConfidenceInput): AuditedConfidenceResult {
  const policy = input.policy ?? loadProductConstitution();
  const fingerprints = confidenceInputFingerprints(input.evidenceLinks, policy);
  const orderedEvidenceLinks = sortedLinks(input.evidenceLinks);
  const result = calculateClaimConfidence({
    claimClass: input.claimClass,
    evidenceLinks: orderedEvidenceLinks,
    ...(input.calculatedAt !== undefined ? { calculatedAt: input.calculatedAt } : {}),
    policy,
  });

  return {
    ...result,
    audit: {
      auditVersion: CONFIDENCE_AUDIT_VERSION,
      engineVersion: CONFIDENCE_ENGINE_VERSION,
      componentVersions: COMPONENT_VERSIONS,
      componentWeights: CONFIDENCE_COMPONENT_WEIGHTS,
      inputFingerprints: fingerprints,
      recalculationReasons: changedInputs(fingerprints, input.previous?.audit.inputFingerprints),
    },
  };
}

/**
 * Gate public wording against both constitution phrases and the evidence's exact procedural status.
 * A caller requesting a different status is capped to the evidence status and must not publish the text.
 */
export function evaluatePublicLanguage(input: {
  readonly text: string;
  readonly requestedProceduralStatus: string;
  readonly evidenceProceduralStatus: string;
  readonly policy?: ProductConstitution;
}): PublicLanguageEvaluation {
  const policy = input.policy ?? loadProductConstitution();
  const language = evaluateProceduralLanguage(input.text, input.evidenceProceduralStatus, policy);
  const statusSupported = isProceduralStatusSupported(
    input.requestedProceduralStatus,
    input.evidenceProceduralStatus,
  );
  const enforceCap = policy.publicationRestrictions.publicLanguageCannotExceedProceduralStatus;

  return {
    allowed: language.supported && (!enforceCap || statusSupported),
    requestedProceduralStatus: input.requestedProceduralStatus,
    evidenceProceduralStatus: input.evidenceProceduralStatus,
    effectiveProceduralStatus: input.evidenceProceduralStatus,
    proceduralStatusRecognized: language.proceduralStatusRecognized,
    violations: [
      ...language.violations,
      ...(enforceCap && !statusSupported ? ['procedural_status_exceeds_evidence'] : []),
    ],
    policyVersion: language.policyVersion,
  };
}

/**
 * Source-tier trust wiring (additive — does not change `recalculateConfidence` above).
 *
 * `../claims/confidence.ts` `CLASSIFICATION_AUTHORITY` already assigns
 * `community_oral` / `self_published` / `news_reportage` a low weight in the weighted
 * composite score. But a weighted average alone cannot guarantee that a claim resting on a
 * single crowdsourced lineage never crosses a publish threshold — if every other component
 * (directness, temporal proximity, geographic precision, entity match, extraction quality)
 * happens to be high, the source-authority component alone may not be enough to hold the
 * line. Crowdsourced items must seed research cases and never publish directly. This module
 * makes that guarantee explicit, testable, and additive: apply
 * `enforceCrowdsourcedCannotPublishAlone` to a `ConfidenceEngineResult` wherever supporting
 * evidence for a claim traces back to these adapters (RSS, Internet Archive, DPLA v2) before
 * treating `passesPublishThreshold` as authoritative.
 */
export const CROWDSOURCED_CLAIM_SOURCE_TIERS = ['community_oral', 'self_published', 'news_reportage'] as const;

export type CrowdsourcedClaimSourceTier = (typeof CROWDSOURCED_CLAIM_SOURCE_TIERS)[number];

export function isCrowdsourcedClaimSourceTier(classification: string): boolean {
  return (CROWDSOURCED_CLAIM_SOURCE_TIERS as readonly string[]).includes(classification);
}

export type EvidenceSourceTierSummary = {
  readonly lineageRootId: string;
  readonly sourceClassification: string;
};

/**
 * True when every contributing supporting lineage is a crowdsourced tier i.e. there is no
 * independent institutional/archival corroboration at all, the case says must never
 * publish on its own regardless of how the weighted score computes.
 */
export function isPurelyCrowdsourcedEvidence(supportingSources: readonly EvidenceSourceTierSummary[]): boolean {
  if (supportingSources.length === 0) return false;
  return supportingSources.every((source) => isCrowdsourcedClaimSourceTier(source.sourceClassification));
}

/**
 * Hard override applied on top of a confidence result: crowdsourced-only supporting evidence is
 * capped below every claim-class publish threshold until at least one non-crowdsourced (or
 * additional independent) lineage corroborates it. The underlying `score` is left untouched
 * the candidate can still surface as a research lead only `passesPublishThreshold` is forced
 * closed.
 */
export function enforceCrowdsourcedCannotPublishAlone<T extends { readonly passesPublishThreshold: boolean }>(
  result: T,
  supportingSources: readonly EvidenceSourceTierSummary[],
): T {
  if (isPurelyCrowdsourcedEvidence(supportingSources)) {
    return { ...result, passesPublishThreshold: false };
  }
  return result;
}

/**
 * additive authority signal: a source class whose citations rot (go dead) quickly is a
 * durability signal worth surfacing alongside the existing confidence components above. This is
 * deliberately a small, separate, named function not a change to `calculateClaimConfidence`'s
 * weighted computation (see `../claims/confidence.ts`) or its component weights. `rotRate` comes
 * from `../citations/rot-telemetry.ts`'s `computeRotRateBySourceClass` (per-source-class
 * deadCount totalCitations, 0..1). Consuming this signal inside the weighted score itself is a
 * follow-up integration decision for whichever owns confidence-component reweighting, not
 * decided here.
 */
export function citationRotRateAuthoritySignal(rotRate: number): number {
  if (!Number.isFinite(rotRate)) {
    throw new Error('citationRotRateAuthoritySignal requires a finite rotRate');
  }
  const clamped = Math.min(1, Math.max(0, rotRate));
  return 1 - clamped;
}

/**
 * additive signal: turns independent-reviewer agreement (see
 * `../consensus-review/index.js`) into a small, capped corroboration input the confidence
 * engine can incorporate. Deliberately isolated from `recalculateConfidence` above it does
 * not change that function, its inputs, or its fingerprints. A caller may optionally apply the
 * bounded adjustment via `withReviewerAgreementCorroboration` below; nothing here is wired
 * into the default recalculation path.
 *
 * `verdict` is intentionally decoupled from consensus-review's `ReviewVerdict` type (this
 * package boundary should not need to know that module's shapes): 'corroborates' means the
 * reviewer majority agreed the lead is legitimate; 'disputes' and 'inconclusive' cover
 * everything else, including ties and below-threshold agreement, and must never contribute a
 * score adjustment that mirrors consensus-review's own rule that disagreement is never
 * silently resolved.
 */
export const REVIEWER_AGREEMENT_SIGNAL_VERSION = 'reviewer-agreement-signal.v1' as const;

export type ReviewerAgreementVerdict = 'corroborates' | 'disputes' | 'inconclusive';

export type ReviewerAgreementSignalInput = {
  readonly reviewCount: number;
  /** Leading verdict's share of reviews, in [0, 1]. */
  readonly agreementRatio: number;
  readonly verdict: ReviewerAgreementVerdict;
};

export type ReviewerAgreementSignal = {
  readonly signalVersion: typeof REVIEWER_AGREEMENT_SIGNAL_VERSION;
  readonly kind: 'reviewer_agreement';
  readonly reviewCount: number;
  readonly agreementRatio: number;
  readonly verdict: ReviewerAgreementVerdict;
  /** Bounded contribution in [0, REVIEWER_AGREEMENT_MAX_WEIGHT] never enough alone to cross a gate. */
  readonly corroborationWeight: number;
  readonly fingerprint: string;
};

/** Hard cap: reviewer agreement alone can never move a score by more than this. */
export const REVIEWER_AGREEMENT_MAX_WEIGHT = 0.05;

/** Pure, deterministic: same input always yields the same signal and fingerprint. */
export function computeReviewerAgreementSignal(
  input: ReviewerAgreementSignalInput,
): ReviewerAgreementSignal {
  if (!Number.isInteger(input.reviewCount) || input.reviewCount < 0) {
    throw new Error('reviewCount must be a non-negative integer');
  }
  if (!Number.isFinite(input.agreementRatio) || input.agreementRatio < 0 || input.agreementRatio > 1) {
    throw new Error('agreementRatio must be between 0 and 1');
  }
  const corroborationWeight =
    input.verdict === 'corroborates'
      ? Math.min(REVIEWER_AGREEMENT_MAX_WEIGHT, input.agreementRatio * REVIEWER_AGREEMENT_MAX_WEIGHT)
      : 0;

  return {
    signalVersion: REVIEWER_AGREEMENT_SIGNAL_VERSION,
    kind: 'reviewer_agreement',
    reviewCount: input.reviewCount,
    agreementRatio: input.agreementRatio,
    verdict: input.verdict,
    corroborationWeight,
    fingerprint: fingerprint({
      signalVersion: REVIEWER_AGREEMENT_SIGNAL_VERSION,
      reviewCount: input.reviewCount,
      agreementRatio: input.agreementRatio,
      verdict: input.verdict,
    }),
  };
}

/**
 * Applies a reviewer-agreement signal on top of an already-computed confidence result.
 * A no-op (returns `result` unchanged) unless the signal both `corroborates` and carries a
 * positive weight 'disputes' and 'inconclusive' must reach a human reviewer upstream in
 * consensus review, never a silent score change here. The adjustment is clamped to [0, 1] and
 * cannot by itself flip `passesPublishThreshold` from false to true unless the unadjusted
 * score was already within `REVIEWER_AGREEMENT_MAX_WEIGHT` of the threshold.
 */
export function withReviewerAgreementCorroboration(
  result: AuditedConfidenceResult,
  signal: ReviewerAgreementSignal,
): AuditedConfidenceResult {
  if (signal.verdict !== 'corroborates' || signal.corroborationWeight <= 0) {
    return result;
  }
  const score = round4(Math.min(1, result.score + signal.corroborationWeight));
  return {
    ...result,
    score,
    passesPublishThreshold: score >= result.threshold,
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Graph-consistency diagnostic (BB the related workstream additive, not wired into
 * `recalculateConfidence` above, following the same pattern as
 * `computeReviewerAgreementSignal`/`citationRotRateAuthoritySignal`).
 *
 * Graph corroboration relationships in the graph agreeing or conflicting with a given edge
 * is a real signal, but it must never be folded into `sourceAuthority` or `lineageIndependence`
 * (`../claims/confidence.ts`): those two components are deliberately evidence-sourced only, so
 * that a bad source's own derived cluster of relationships can never launder itself into a
 * higher score by corroborating itself through the graph. This diagnostic is the ONLY place
 * graph corroboration is allowed to surface today; a future integration may additionally let it
 * inform `entityMatchQuality`, but that composition is not implemented here — this function only
 * computes and returns the diagnostic.
 */
export const GRAPH_CONSISTENCY_SIGNAL_VERSION = 'graph-consistency-signal.v1' as const;

export type GraphConsistencyRelationshipObservation = {
  readonly relationshipId: string;
  /** True when this other relationship independently corroborates the edge under evaluation
   * (same or compatible assertion between the same resolved entity pair); false when it
   * conflicts with it. */
  readonly agrees: boolean;
};

export type GraphConsistencySignalInput = {
  /** The relationship being diagnosed. Any observation carrying this same id is excluded before
   * scoring an edge is never allowed to corroborate itself (see
   * `assertRelationshipNotSoleSelfCorroboration` in `../relationship-publish.js`). */
  readonly relationshipId: string;
  readonly observations: readonly GraphConsistencyRelationshipObservation[];
};

export type GraphConsistencySignal = {
  readonly signalVersion: typeof GRAPH_CONSISTENCY_SIGNAL_VERSION;
  readonly kind: 'graph_consistency';
  readonly relationshipId: string;
  readonly agreeingCount: number;
  readonly conflictingCount: number;
  /** [0, 1] diagnostic only; never applied to `score`/`passesPublishThreshold` here. */
  readonly graphConsistency: number;
  readonly fingerprint: string;
};

/** Pure, deterministic, and self-corroboration-safe: any observation whose `relationshipId`
 * matches the edge under evaluation is dropped before the ratio is computed. */
export function computeGraphConsistencySignal(
  input: GraphConsistencySignalInput,
): GraphConsistencySignal {
  const others = input.observations.filter(
    (observation) => observation.relationshipId !== input.relationshipId,
  );
  const agreeingCount = others.filter((observation) => observation.agrees).length;
  const conflictingCount = others.length - agreeingCount;
  const total = agreeingCount + conflictingCount;
  const graphConsistency = total === 0 ? 0 : round4(agreeingCount / total);

  return {
    signalVersion: GRAPH_CONSISTENCY_SIGNAL_VERSION,
    kind: 'graph_consistency',
    relationshipId: input.relationshipId,
    agreeingCount,
    conflictingCount,
    graphConsistency,
    fingerprint: fingerprint({
      signalVersion: GRAPH_CONSISTENCY_SIGNAL_VERSION,
      relationshipId: input.relationshipId,
      agreeingCount,
      conflictingCount,
    }),
  };
}

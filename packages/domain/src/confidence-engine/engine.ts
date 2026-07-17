/**
 * Versioned confidence orchestration built on the BB-017 deterministic scorer.
 * Records input fingerprints, component versions, recalculation causes, and public-language gates.
 */
import { createHash } from 'node:crypto';
import {
  evaluateProceduralLanguage,
  loadProductConstitution,
  type ProductConstitution,
} from '@black-book/schemas';
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

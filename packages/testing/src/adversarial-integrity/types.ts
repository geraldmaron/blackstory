/**
 * Shared types for adversarial integrity exercise harnesses.
 * Scenarios compose @repo/security and @repo/domain gates locally no live attacks.
 */

/** Red-team scenario identifiers aligned with acceptance criteria. */
export type AdversarialIntegrityScenarioId =
  | 'false_source_submissions'
  | 'source_laundering'
  | 'coordinated_citation_repetition'
  | 'altered_documents'
  | 'misidentified_people'
  | 'living_address_attempts'
  | 'procedural_status_inflation'
  | 'race_inference'
  | 'relevance_gaming'
  | 'moderator_social_engineering'
  | 'unauthorized_publication';

/** Integrity control families exercised by the harness. */
export type IntegrityControlLayer =
  | 'submission_quarantine'
  | 'promotion_gate'
  | 'lineage_collapse'
  | 'confidence_threshold'
  | 'public_language'
  | 'public_serialization'
  | 'research_case_workflow'
  | 'relevance_gate'
  | 'consensus_review'
  | 'sybil_signals'
  | 'top_tier_source_gate';

export type IntegrityControlProof = {
  readonly layer: IntegrityControlLayer;
  readonly reason: string;
};

export type AdversarialScenarioRunResult = {
  readonly scenarioId: AdversarialIntegrityScenarioId;
  readonly stepsExecuted: number;
  readonly attackBlocked: boolean;
  readonly publicContentMutated: boolean;
  readonly controlsTriggered: readonly IntegrityControlProof[];
  readonly lineageInflationPrevented?: boolean;
  readonly publicLanguageConstrained?: boolean;
};

export type AdversarialIntegritySummary = {
  readonly scenarioId: AdversarialIntegrityScenarioId;
  readonly result: AdversarialScenarioRunResult;
};

export const ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS: readonly AdversarialIntegrityScenarioId[] = [
  'false_source_submissions',
  'source_laundering',
  'coordinated_citation_repetition',
  'altered_documents',
  'misidentified_people',
  'living_address_attempts',
  'procedural_status_inflation',
  'race_inference',
  'relevance_gaming',
  'moderator_social_engineering',
  'unauthorized_publication',
] as const;

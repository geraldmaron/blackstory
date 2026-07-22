/**
 * Local fixture types for theme-impact packets. Mirrors the upcoming domain
 * ThemeImpactPacket contract so pages can ship before live DB wiring.
 */

export const THEME_IMPACT_GAP_STATES = ['insufficient_evidence', 'modeled'] as const;
export type ThemeImpactGapState = (typeof THEME_IMPACT_GAP_STATES)[number];

export const THEME_IMPACT_METHOD_STANCES = ['juxtaposition', 'gated_causal_claim'] as const;
export type ThemeImpactMethodStance = (typeof THEME_IMPACT_METHOD_STANCES)[number];

/** Provenance quartet plus a reader-facing citation string. */
export type ThemeImpactProvenance = {
  readonly source: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly content_hash: string;
  readonly humanCitation: string;
};

export type ThemeImpactObservation = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly referencePeriod?: string;
  readonly provenance: ThemeImpactProvenance;
};

export type ThemeImpactDerived = {
  readonly id: string;
  readonly methodId: string;
  readonly label: string;
  readonly value: string;
  readonly provenance: ThemeImpactProvenance;
};

export type ThemeImpactArtifact = {
  readonly id: string;
  readonly title: string;
  readonly artifactClass: string;
  readonly dateLabel?: string;
  readonly summary: string;
  readonly uncertaintyLabel?: string;
  readonly provenance: ThemeImpactProvenance;
};

export type ThemeImpactGeography = {
  readonly unit: string;
  readonly label: string;
  readonly boundaryVersion?: string;
};

export type ThemeImpactPolicyEra = {
  readonly id: string;
  readonly label: string;
  readonly span?: string;
};

/** Fixture packet shape aligned with docs/research/theme-impact-canonical-questions.md §7. */
export type ThemeImpactPacketFixture = {
  readonly questionId: string;
  readonly themeId: string;
  readonly question: string;
  readonly policyEras: readonly ThemeImpactPolicyEra[];
  readonly geography: ThemeImpactGeography;
  readonly methodStance: ThemeImpactMethodStance;
  readonly methodNote: string;
  readonly observationsSummary: string;
  readonly observations: readonly ThemeImpactObservation[];
  readonly derived: readonly ThemeImpactDerived[];
  readonly artifacts: readonly ThemeImpactArtifact[];
  readonly gapStates: readonly ThemeImpactGapState[];
};

export type ThemeImpactCatalogEntry = {
  readonly id: string;
  readonly title: string;
  readonly priority: 'P0' | 'P1';
  readonly lede: string;
  readonly available: boolean;
};

/**
 * Theme-impact catalog types for native mobile.
 * Packet views mirror `@repo/domain` ThemeImpactPacketView without importing domain.
 */

export type ThemeImpactPriority = 'P0' | 'P1';

export type ThemeImpactMethodStance = 'juxtaposition' | 'gated_causal_claim';

export type ThemeImpactGapState = 'insufficient_evidence' | 'modeled';

export type ThemeCatalogEntry = {
  readonly id: string;
  readonly title: string;
  readonly priority: ThemeImpactPriority;
  readonly lede: string;
  readonly available: boolean;
};

export type ThemePacketProvenance = {
  readonly source: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly content_hash: string;
  readonly humanCitation: string;
};

export type ThemePacketObservation = {
  readonly id: string;
  readonly metricId?: string;
  readonly label: string;
  readonly value: string;
  readonly referencePeriod?: string;
  readonly provenance: ThemePacketProvenance;
};

export type ThemePacketDerived = {
  readonly id: string;
  readonly methodId: string;
  readonly label: string;
  readonly value: string;
  readonly provenance: ThemePacketProvenance;
};

export type ThemePacketArtifact = {
  readonly id: string;
  readonly title: string;
  readonly artifactClass: string;
  readonly dateLabel?: string;
  readonly summary: string;
  readonly uncertaintyLabel?: string;
  readonly provenance?: ThemePacketProvenance;
};

export type ThemePacketView = {
  readonly packetId?: string;
  readonly questionId: string;
  readonly themeId: string;
  readonly question: string;
  readonly policyEras: readonly {
    readonly id: string;
    readonly label: string;
    readonly span?: string;
  }[];
  readonly geography: {
    readonly unit: string;
    readonly label: string;
    readonly boundaryVersion?: string;
  };
  readonly methodStance: ThemeImpactMethodStance;
  readonly methodNote: string;
  readonly observationsSummary: string;
  readonly observations: readonly ThemePacketObservation[];
  readonly derived: readonly ThemePacketDerived[];
  readonly artifacts: readonly ThemePacketArtifact[];
  readonly gapStates: readonly ThemeImpactGapState[];
  readonly dataSource?: 'live' | 'fixture' | 'release';
};

export type ThemesCatalogSnapshot = {
  readonly version: string;
  readonly generatedAt: string;
  readonly source: string;
  /** Supabase release the packets were exported from (`rel_…`). */
  readonly releaseId: string;
  readonly releaseLabel: string;
  readonly themes: readonly ThemeCatalogEntry[];
  readonly packets: readonly ThemePacketView[];
};

/** Compact row model for the browse ledger. */
export type ThemesCatalogRow = {
  readonly id: string;
  readonly title: string;
  readonly priority: ThemeImpactPriority;
  readonly priorityLabel: string;
  readonly lede: string;
  readonly available: boolean;
  readonly packetCount: number;
  readonly statusLabel: string;
};

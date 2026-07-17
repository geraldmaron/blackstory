/**
 * Versioned historical query pack types: term classes, themes, signal strength,
 * and discovery-run stamping.
 */
import type { EntityKind } from '../entity-kinds.js';

export const QUERY_PACK_SCHEMA_VERSION = 'query-pack.v1' as const;

/** Term classes used to compose discovery queries by entity type and theme. */
export const TERM_CLASSES = [
  'positive',
  'negative',
  'historical',
  'modern',
  'geographic',
  'alias',
  'source_specific',
] as const;

export type TermClass = (typeof TERM_CLASSES)[number];

export const SIGNAL_STRENGTHS = ['strong', 'medium', 'weak'] as const;

export type SignalStrength = (typeof SIGNAL_STRENGTHS)[number];

/** Maturity states a matched record may reach based on signal strength. */
export const MATCH_OUTCOMES = ['promotable', 'candidate_only'] as const;

export type MatchOutcome = (typeof MATCH_OUTCOMES)[number];

/** Research themes grouping query packs beyond raw entity kind. */
export const QUERY_PACK_THEMES = [
  'civil_rights',
  'education_segregation',
  'archival_person',
  'historical_place',
  'institutional_records',
  'legal_case',
] as const;

export type QueryPackTheme = (typeof QUERY_PACK_THEMES)[number];

export type QueryTerm = {
  readonly text: string;
  readonly termClass: TermClass;
  /** When true, term is retained for research queries but never default public language. */
  readonly researchOnlyOffensive?: boolean;
  /** Required adapter/source id when termClass is `source_specific`. */
  readonly sourceId?: string;
  /** Optional weight hint for effectiveness metrics (default 1). */
  readonly weight?: number;
};

export type QueryPackVersion = {
  /** Semver for human review (e.g. 1.0.0). */
  readonly semver: string;
  /** sha256 digest of canonical pack content for reproducibility. */
  readonly contentHash: string;
};

/** Composite version id: semver+shortHash for discovery-run stamping. */
export type QueryPackVersionId = `${string}+${string}`;

export type QueryPack = {
  readonly schemaVersion: typeof QUERY_PACK_SCHEMA_VERSION;
  readonly id: string;
  readonly displayName: string;
  readonly entityKind: EntityKind;
  readonly theme: QueryPackTheme;
  readonly version: QueryPackVersion;
  readonly versionId: QueryPackVersionId;
  readonly terms: readonly QueryTerm[];
  readonly createdAt: string;
  readonly notes?: string;
};

export type PublicSafeTerm = {
  readonly text: string;
  readonly termClass: TermClass;
  readonly redacted: boolean;
  readonly redactionReason?: 'research_only_offensive' | 'offensive_historical';
};

export type DiscoveryRunContext = {
  readonly runId: string;
  readonly adapterId: string;
  readonly startedAt: string;
  readonly entityKind?: EntityKind;
  readonly theme?: QueryPackTheme;
};

export type StampedDiscoveryRun = DiscoveryRunContext & {
  readonly queryPackId: string;
  readonly queryPackVersionId: QueryPackVersionId;
  readonly queryPackSemver: string;
  readonly queryPackContentHash: string;
  readonly stampedAt: string;
};

export type QueryPackEffectivenessRecord = {
  readonly packId: string;
  readonly versionId: QueryPackVersionId;
  readonly runId: string;
  readonly recordedAt: string;
  readonly queriesExecuted: number;
  readonly matchesObserved: number;
  readonly exclusionsObserved: number;
  readonly falsePositiveObserved: number;
};

export type QueryPackEffectivenessMetrics = {
  readonly packId: string;
  readonly versionId: QueryPackVersionId;
  readonly recordCount: number;
  readonly totalQueries: number;
  readonly totalMatches: number;
  readonly totalExclusions: number;
  readonly totalFalsePositives: number;
  readonly matchRate: number;
  readonly exclusionRate: number;
  readonly falsePositiveRate: number;
  readonly effectivenessScore: number;
};

export type FixtureMatchExpectation = {
  readonly input: string;
  readonly shouldMatch: boolean;
  readonly expectedOutcome?: MatchOutcome;
  readonly matchedTermClasses?: readonly TermClass[];
};

export type QueryPackFixture = {
  readonly schemaVersion: typeof QUERY_PACK_SCHEMA_VERSION;
  readonly pack: Omit<QueryPack, 'versionId'>;
  readonly expectations: readonly FixtureMatchExpectation[];
};

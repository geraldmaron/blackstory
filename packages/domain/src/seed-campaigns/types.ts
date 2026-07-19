/**
 * Versioned contracts for national seed campaigns: quality-first, fixture-only
 * seed records grouped by thematic campaign. These are structured fixtures and validators
 * never live Firestore apply payloads.
 */
import type { GeoPrecisionTier } from '../geography/precision.js';
import type { NotabilityBasisRecord } from '../entity-status.js';
import type { Citation } from '../citations/citation.js';

export const SEED_CAMPAIGN_SCHEMA_VERSION = 'seed-campaign.v1' as const;

/** Thematic campaigns for national seed fixtures. */
export const SEED_CAMPAIGN_IDS = [
  'rosenwald-schools',
  'freedmens-schools',
  'hbcu-sample',
  'desegregation-litigation-schools',
  'black-educational-movements',
  'nationally-significant-institutions',
] as const;

export type SeedCampaignId = (typeof SEED_CAMPAIGN_IDS)[number];

export function isSeedCampaignId(value: string): value is SeedCampaignId {
  return (SEED_CAMPAIGN_IDS as readonly string[]).includes(value);
}

/** U.S. Census Bureau regions for geographic diversity reporting (50 states + D.C.). */
export const US_CENSUS_REGIONS = ['Northeast', 'Midwest', 'South', 'West'] as const;
export type UsCensusRegion = (typeof US_CENSUS_REGIONS)[number];

export type SeedRecordCompleteness = 'sparse' | 'partial' | 'substantial';

/** Citation fields required by structural completeness no invented capture content. */
export type SeedCitation = Pick<Citation, 'sourceName' | 'location' | 'capture' | 'retrievalDate'> & {
  readonly id: string;
};

export type SeedClaim = {
  readonly id: string;
  /** Factual, source-backed statement never an invented biography. */
  readonly statement: string;
};

/**
 * One high-confidence seed record. Count is quality-driven: a campaign may ship fewer than
 * its soft target when evidence is insufficient rather than padding with weak entries.
 */
export type SeedRecord = {
  readonly id: string;
  readonly campaignId: SeedCampaignId;
  readonly displayName: string;
  readonly kind: 'school' | 'institution';
  readonly stateOrTerritory: string;
  readonly censusRegion: UsCensusRegion;
  readonly city?: string;
  readonly coordinates?: { readonly lat: number; readonly lng: number };
  readonly documentedGeoPrecisionTier: GeoPrecisionTier;
  readonly notabilityBasis: NotabilityBasisRecord;
  readonly citations: readonly SeedCitation[];
  readonly claims: readonly SeedClaim[];
  readonly completeness: SeedRecordCompleteness;
  /** Launch-corpus slug when vetting applies (e.g. nrhp, hbcu-list). */
  readonly sourceCorpus?: string;
  readonly inclusionRationale: string;
  readonly externalIds?: readonly { readonly system: string; readonly value: string }[];
};

export type SeedCampaignMeta = {
  readonly id: SeedCampaignId;
  readonly displayName: string;
  readonly description: string;
  /** Soft target actual count may be lower when quality gates thin the set. */
  readonly qualityTargetCount: number;
  readonly preferredNotabilityCriteria: readonly NotabilityBasisRecord['criterion'][];
};

export type SeedCampaignBundle = {
  readonly schemaVersion: typeof SEED_CAMPAIGN_SCHEMA_VERSION;
  readonly campaignVersion: string;
  readonly curatedAt: string;
  readonly curatedBy: string;
  readonly campaigns: readonly SeedCampaignMeta[];
  readonly records: readonly SeedRecord[];
};

export type SeedValidationFailure = {
  readonly recordId: string;
  readonly gate: string;
  readonly reason: string;
};

export type SeedValidationResult =
  | { readonly ok: true; readonly recordCount: number; readonly byCampaign: Readonly<Record<SeedCampaignId, number>> }
  | { readonly ok: false; readonly failures: readonly SeedValidationFailure[] };

export type GeographicCoverageReport = {
  readonly byRegion: Readonly<Record<UsCensusRegion, number>>;
  readonly byState: Readonly<Record<string, number>>;
  readonly representedRegions: readonly UsCensusRegion[];
  readonly missingRegions: readonly UsCensusRegion[];
};

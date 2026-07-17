/**
 * Public module boundary for national seed campaigns (fixture-only no Firestore apply).
 */
export {
  SEED_CAMPAIGN_SCHEMA_VERSION,
  SEED_CAMPAIGN_IDS,
  US_CENSUS_REGIONS,
  isSeedCampaignId,
  type SeedCampaignId,
  type UsCensusRegion,
  type SeedRecordCompleteness,
  type SeedCitation,
  type SeedClaim,
  type SeedRecord,
  type SeedCampaignMeta,
  type SeedCampaignBundle,
  type SeedValidationFailure,
  type SeedValidationResult,
  type GeographicCoverageReport,
} from './types.js';

export { censusRegionForState, assertKnownUsState } from './regions.js';
export { SEED_CAMPAIGN_METADATA, seedCampaignMeta } from './campaigns.js';

export {
  ROSENWALD_SCHOOL_RECORDS,
  FREEDMENS_SCHOOL_RECORDS,
  HBCU_SAMPLE_RECORDS,
  DESEGREGATION_LITIGATION_RECORDS,
  BLACK_EDUCATIONAL_MOVEMENT_RECORDS,
  NATIONALLY_SIGNIFICANT_RECORDS,
  ALL_SEED_RECORDS,
} from './records.js';

export {
  NATIONAL_SEED_CAMPAIGN_VERSION,
  NATIONAL_SEED_MAX_RECORDS,
  buildNationalSeedCampaignBundle,
  NATIONAL_SEED_CAMPAIGN_BUNDLE,
  recordsByCampaign,
  countRecordsByCampaign,
} from './bundle.js';

export {
  assertSeedRecordSchemaValid,
  assertSeedRecordEvidenceGate,
  assertSeedRecordNotabilityGate,
  assertSeedRecordCampaignThematicFit,
  assertSeedRecordCorpusPromotionGate,
  evaluateSeedRecordGates,
  assertAllSeedRecordsPassGates,
  assertNationalSeedNotBulkImport,
  computeGeographicCoverage,
  validateNationalSeedCampaign,
  type SeedGateResult,
} from './validators.js';

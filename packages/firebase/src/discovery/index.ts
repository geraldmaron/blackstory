/**
 * Discovery campaign run persistence helpers and research-campaigns kill switch reads.
 */
export {
  DISCOVERY_CAMPAIGN_RUN_STATUSES,
  DISCOVERY_CAMPAIGN_RUN_MODES,
  RESEARCH_CAMPAIGNS_KILL_SWITCH_ID,
  buildDiscoveryCampaignRunDoc,
  assertDiscoveryRunCannotPublish,
  createInMemoryDiscoveryCampaignRunStore,
} from './campaign-run.js';
export type {
  DiscoveryCampaignRunStatus,
  DiscoveryCampaignRunMode,
  BuildDiscoveryCampaignRunInput,
  DiscoveryCampaignRunStore,
} from './campaign-run.js';

export {
  isKillSwitchEngagedFromDoc,
  isResearchCampaignsKillSwitchEngaged,
  fetchResearchCampaignsKillSwitch,
  isResearchCampaignsKillSwitchEngagedIn,
} from './kill-switch.js';
export type { KillSwitchDocSnapshot, DocGetter } from './kill-switch.js';

export {
  DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX,
  resolutionProfileFromCatalogLeaf,
  resolutionProfileFromPublicSearchIndex,
  publicSearchIndexDocFromRow,
  loadDiscoveryCatalogProfiles,
  createPublicSearchIndexCatalogPager,
  createFirestorePublicSearchIndexCatalogPager,
} from './catalog-profiles.js';
export type {
  DiscoveryCatalogLeaf,
  DiscoveryCatalogPage,
  DiscoveryCatalogPager,
} from './catalog-profiles.js';

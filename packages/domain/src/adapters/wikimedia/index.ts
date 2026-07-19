/**
 * Wikimedia discovery adapter public surface.
 */
export {
  DEFAULT_WIKIMEDIA_CATEGORY_GRAPH,
  getCategoryGraphNode,
  listExpandCategoryTitles,
  listSeedCategoryTitles,
  normalizeCategoryTitle,
  resolveGraphNodeIdByTitle,
  traverseCategoryGraph,
  type CategoryGraph,
  type CategoryGraphEdge,
  type CategoryGraphNode,
  type CategoryGraphNodeRole,
} from './category-graph.js';

export {
  assertCategoryGatePassed,
  evaluateCategoryGate,
  type EvaluateCategoryGateInput,
} from './category-gate.js';

export { createWikimediaAdapterContract, WIKIMEDIA_ATTRIBUTION } from './contract.js';

export {
  buildStableIdentifier,
  buildWikipediaCanonicalUrl,
  extractAliases,
  extractExternalReferences,
  extractLocations,
  extractPageCategories,
  extractRelationships,
  extractWikidataId,
  readLatestRevision,
  resolvePageTitle,
  routeExternalReferenceUrl,
} from './extractors.js';

export {
  assertWikimediaCandidate,
  candidatesEquivalent,
  normalizeWikimediaApiFetch,
  normalizeWikimediaBulkBatch,
  normalizeWikimediaBulkRecord,
  normalizeWikimediaPage,
  type NormalizeWikimediaPageInput,
} from './normalizer.js';

export {
  assertSearchSnippetsNotCopied,
  parseMediaWikiSearchResponse,
  searchHitPageIds,
} from './search.js';

export {
  buildApiFetchFromFixtures,
  parseMediaWikiPageResponse,
  parseWikidataEntityResponse,
} from './api.js';

export { chunkBulkRecords, parseWikimediaBulkBatch } from './bulk.js';

export {
  COMMONS_MEDIA_OUTCOMES,
  COMMONS_MEDIA_PROPOSE_VERSION,
  buildAltText,
  buildCreditLine,
  chunkForWikimediaBatch,
  commonsFilePageUrl,
  enwikiTitleFromDisplayName,
  evaluateCommonsMediaPropose,
  extractP18Candidates,
  isExactLabelMatch,
  isUnknownCreatorCredit,
  mapCommonsLicenseToRights,
  normalizeLabel,
  sanitizePrimaryImageCreditForDisplay,
  selectSingleP18,
  stripHtml,
  summarizeCommonsMediaProposes,
  wikipediaEnUrl,
  wikidataUrl,
  type CommonsImageMetadata,
  type CommonsMediaDryRunCounts,
  type CommonsMediaOutcome,
  type CommonsMediaPropose,
  type CommonsP18Candidate,
  type EntityMediaEnrichmentInput,
  type EntityResourceLinkPropose,
} from './commons-media.js';

export {
  WIKIMEDIA_USER_AGENT,
  createCommonsMediaClient,
  type CommonsMediaClient,
  type EnwikiTitleResolveResult,
  type FetchCommonsMediaClientOptions,
  type WikimediaHttpFetch,
} from './commons-media-client.js';

export {
  runCommonsMediaEnrichment,
  type RunCommonsMediaEnrichmentInput,
  type RunCommonsMediaEnrichmentResult,
} from './commons-media-enrichment.js';

export {
  WIKIMEDIA_ADAPTER_ID,
  WIKIMEDIA_INGEST_MODES,
  WIKIMEDIA_PARSER_VERSION,
  WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
  WIKIMEDIA_STABLE_ID_SCHEME,
  type MediaWikiPage,
  type MediaWikiPageResponse,
  type MediaWikiSearchHit,
  type MediaWikiSearchResponse,
  type WikidataEntity,
  type WikidataEntityResponse,
  type WikimediaApiFetch,
  type WikimediaAttribution,
  type WikimediaBulkBatch,
  type WikimediaBulkPageRecord,
  type WikimediaCandidatePayload,
  type WikimediaCandidateRecord,
  type WikimediaCategoryGateResult,
  type WikimediaExternalReference,
  type WikimediaIngestMode,
  type WikimediaLocationHint,
  type WikimediaRelationship,
} from './types.js';

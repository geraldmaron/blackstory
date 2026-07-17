/**
 * Wikimedia discovery adapter public surface (BB-045).
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

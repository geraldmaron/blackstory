/**
 * Content feature barrel: the neutral publication machinery — the on-device catalog, the
 * repository, block normalization, the renderer, and the link-safety and staleness rules.
 *
 * Neutral on purpose. Stories renders narrative through it and the supporting rooms (About,
 * Methodology, Privacy, Errata) render reference through it, so it must not know which of the
 * two it is serving. This is the half of the old `features/learn` boundary that was genuinely
 * shared; the narrative half moved to `features/stories`.
 */
export {
  CONTENT_CATALOG,
  listCatalogEntries,
  findCatalogEntry,
  type ContentEntry,
  type CatalogSectionId,
  type StoryFormat,
} from './content-catalog';
export { parseSectionParam, parseSlugParam, KNOWN_SECTION_ROUTE_IDS } from './route-guards';
export {
  STORY_SECTIONS,
  SUPPORTING_SECTIONS,
  ALL_SECTIONS,
  findSectionRow,
  isNarrativeSection,
  isSupportingSection,
  legacyLearnTarget,
  type LegacyLearnTarget,
  sectionBackFallback,
  type SectionRow,
} from './sections';
export { ContentPageScreen } from './ContentPageScreen';
export { ContentRenderer, type ContentPresentation } from './ContentRenderer';
export {
  normalizeContentPage,
  normalizeTypedContentPage,
  type NormalizedBlock,
} from './content-blocks';
export {
  relatedEntitySubtitle,
  resolveRelatedEntityLabel,
  type RelatedEntityLabel,
} from './related-entity-labels';
export { sanitizeExternalHref, isSafeExternalHref } from './link-safety';
export { isLegalVersionStale, isContentVersionStale } from './legal-version';
export {
  createContentRepository,
  UNBOOTSTRAPPED_STAMP,
  type ContentReadResult,
} from './content-repository';
export { useContentPage } from './useContentPage';

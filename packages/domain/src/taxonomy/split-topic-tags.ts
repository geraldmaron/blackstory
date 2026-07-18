/**
 * Migration logic (black-book-s4hp): splits a legacy `topicTags` array into the four
 * controlled-taxonomy fields (`topicIds`, `mentionedEntityIds`, `keywords`) — `campaignIds`
 * has no legacy source (it's internal ingestion/research campaign membership, never derived
 * from a public-facing tag) so it isn't produced here.
 *
 * Routing rules, in order:
 *  1. A tag matching a registered `TOPIC_REGISTRY` id -> `topicIds` (validated theme).
 *  2. A tag in `ORGANIZATION_SHAPED_LEGACY_TAGS` or `EVENT_OR_LAW_SHAPED_LEGACY_TAGS` ->
 *     `mentionedEntityIds`, carried through as a raw string placeholder id (no real
 *     entity-resolution here — see topics.ts's header comment; that's black-book-8bck's job).
 *  3. Anything else (a tag that was never part of the vetted allowlist, i.e. genuine free text)
 *     -> `keywords`, since it's clearly not a theme and doesn't look person/org/event-shaped
 *     either.
 */
import {
  EVENT_OR_LAW_SHAPED_LEGACY_TAGS,
  ORGANIZATION_SHAPED_LEGACY_TAGS,
  isValidTopicId,
} from './topics.js';

export type SplitTopicTagsResult = {
  readonly topicIds: readonly string[];
  readonly mentionedEntityIds: readonly string[];
  readonly keywords: readonly string[];
};

export function splitTopicTags(topicTags: readonly string[]): SplitTopicTagsResult {
  const topicIds: string[] = [];
  const mentionedEntityIds: string[] = [];
  const keywords: string[] = [];

  for (const tag of topicTags) {
    if (isValidTopicId(tag)) {
      topicIds.push(tag);
    } else if (ORGANIZATION_SHAPED_LEGACY_TAGS.has(tag) || EVENT_OR_LAW_SHAPED_LEGACY_TAGS.has(tag)) {
      mentionedEntityIds.push(tag);
    } else {
      keywords.push(tag);
    }
  }

  return { topicIds, mentionedEntityIds, keywords };
}

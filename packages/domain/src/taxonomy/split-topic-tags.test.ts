/**
 * Tests for legacy topic-tag split + canonical mention-id resolution.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { splitTopicTags } from './split-topic-tags.js';
import {
  LEGACY_MENTION_TAG_TO_ENTITY_ID,
  ORGANIZATION_SHAPED_LEGACY_TAGS,
  EVENT_OR_LAW_SHAPED_LEGACY_TAGS,
  resolveLegacyMentionTag,
} from './topics.js';

test('splitTopicTags resolves org/event legacy tags to ent_* ids', () => {
  const result = splitTopicTags(['civil-rights', 'sclc', 'selma', 'unknown-free-text']);
  assert.deepEqual(result.topicIds, ['civil-rights']);
  assert.deepEqual(result.mentionedEntityIds, [
    LEGACY_MENTION_TAG_TO_ENTITY_ID.sclc,
    LEGACY_MENTION_TAG_TO_ENTITY_ID.selma,
  ]);
  assert.deepEqual(result.keywords, ['unknown-free-text']);
});

test('every organization/event legacy tag has a canonical entity mapping', () => {
  for (const tag of ORGANIZATION_SHAPED_LEGACY_TAGS) {
    assert.ok(
      resolveLegacyMentionTag(tag)?.startsWith('ent_'),
      `missing mapping for org tag ${tag}`,
    );
  }
  for (const tag of EVENT_OR_LAW_SHAPED_LEGACY_TAGS) {
    assert.ok(
      resolveLegacyMentionTag(tag)?.startsWith('ent_'),
      `missing mapping for event/law tag ${tag}`,
    );
  }
});

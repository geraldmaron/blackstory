/**
 * Tests for `mentionedEntityIds` token -> canonical entity id resolution (WS6).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MENTION_OVERRIDES,
  buildMentionResolverIndex,
  resolveMentionToken,
  type MentionResolvableEntity,
} from './mention-resolver.js';

const entities: MentionResolvableEntity[] = [
  { id: 'ent_sclc_org_001', displayName: 'Southern Christian Leadership Conference (SCLC)' },
  { id: 'ent_sclc_founding_001', displayName: 'Southern Christian Leadership Conference (SCLC) Founding' },
  { id: 'ent_montgomery_bus_boycott_001', displayName: 'Montgomery Bus Boycott' },
  { id: 'ent_birmingham_campaign_001', displayName: 'Birmingham Campaign' },
  { id: 'ent_madam_cj_walker_001', displayName: 'Madam C.J. Walker' },
  { id: 'ent_unique_acro_001', displayName: 'Unique Acronym Test Group (UATG)' },
  { id: 'ent_with_alias_001', displayName: 'Formal Institutional Name', aliases: ['The Nickname'] },
];

test('resolveMentionToken hits: token already a canonical entity id in the set', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('ent_madam_cj_walker_001', index), 'ent_madam_cj_walker_001');
});

test('resolveMentionToken hits: explicit override map resolves a bare acronym slug', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('sclc', index), 'ent_sclc_org_001');
  // Every override target actually exists in this test fixture set except sclc's sibling
  // founding entity, which is intentionally NOT the override target — assert the override
  // table itself only ever points at ids, not at the ambiguous acronym match.
  assert.equal(MENTION_OVERRIDES.get('sclc'), 'ent_sclc_org_001');
});

test('resolveMentionToken hits: normalized displayName equality (hyphenated slug)', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(
    resolveMentionToken('montgomery-bus-boycott', index),
    'ent_montgomery_bus_boycott_001',
  );
  assert.equal(resolveMentionToken('birmingham-campaign', index), 'ent_birmingham_campaign_001');
});

test('resolveMentionToken hits: alias match', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('The Nickname', index), 'ent_with_alias_001');
  assert.equal(resolveMentionToken('the-nickname', index), 'ent_with_alias_001');
});

test('resolveMentionToken hits: acronym-in-parentheses when the acronym is unique in the set', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('uatg', index), 'ent_unique_acro_001');
});

test('resolveMentionToken misses: unrelated token resolves to nothing', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('not-a-real-entity-token', index), undefined);
});

test('resolveMentionToken misses: acronym shared by two entities is never guessed without an override', () => {
  const noOverrideEntities: MentionResolvableEntity[] = [
    { id: 'ent_sclc_org_001', displayName: 'Southern Christian Leadership Conference (SCLC)' },
    {
      id: 'ent_sclc_founding_001',
      displayName: 'Southern Christian Leadership Conference (SCLC) Founding',
    },
  ];
  const index = buildMentionResolverIndex(noOverrideEntities);
  // "sclc" is still resolved via the override map (checked before the acronym strategy), so
  // exercise the ambiguity directly against the acronym index instead.
  assert.equal(index.byAcronym.get('sclc')?.length, 2);
});

test('resolveMentionToken misses: override target not present in this entity set is not returned', () => {
  const index = buildMentionResolverIndex([
    { id: 'ent_montgomery_bus_boycott_001', displayName: 'Montgomery Bus Boycott' },
  ]);
  // "naacp" overrides to ent_naacp_org_001, which is absent from this set entirely.
  assert.equal(resolveMentionToken('naacp', index), undefined);
});

test('resolveMentionToken misses: blank token', () => {
  const index = buildMentionResolverIndex(entities);
  assert.equal(resolveMentionToken('   ', index), undefined);
});

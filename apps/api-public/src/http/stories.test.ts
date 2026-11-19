/**
 * `/v1/stories` and `/v1/stories/{slug}`: the projection-to-wire mapping and the two handlers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientAttestationHeaders } from '@repo/security';
import type { PublicStoryProjectionDoc } from '@repo/schemas';
import { storiesResponseV1Schema, storyV1Schema } from '@repo/public-contracts/v1/story';
import { createPublicRateLimitGuard, resolvePublicEndpointClass } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createInMemoryPublicDataAccess } from './data-access.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';
import { SAMPLE_POINTER } from './entity-fixture.js';
import { toRuns, toStoryV1 } from './story-mapping.js';

const LINCOLN: PublicStoryProjectionDoc = {
  id: 'story_potus_16_abraham_lincoln',
  releaseId: 'rel_test',
  slug: 'abraham-lincoln',
  format: 'entry',
  title: 'Abraham Lincoln',
  summary:
    'Lincoln signed the District of Columbia Compensated Emancipation Act on April 16, 1862.',
  publishedAt: '2026-08-07',
  eraLabel: '1861–1865',
  placeLabel: 'United States',
  collection: { id: 'presidents', label: 'The presidents on the record', position: 16 },
  tags: [],
  heroImage: {
    url: 'https://upload.wikimedia.org/lincoln.jpg',
    alt: 'Portrait of Abraham Lincoln',
    credit: 'Alexander Gardner studio, 1865',
    rightsStatus: 'public_domain',
    objectPath: 'internal/path.jpg',
  },
  body: [
    { type: 'heading', level: 2, text: 'The record' },
    {
      type: 'paragraph',
      text: 'He signed **the act** at [[ent_dc|the capital]].[ref:nara-dc] See [the text](https://www.archives.gov/x).[ref:missing]',
    },
    { type: 'list', style: 'bullet', items: ['April 16, 1862: signed it.[ref:senate-dc]'] },
    { type: 'figure', packetId: 'pkt_1', caption: 'Wealth per person' },
    { type: 'mapInset', entityId: 'ent_greenwood' },
  ],
  references: [
    { id: 'nara-dc', label: 'National Archives', url: 'https://www.archives.gov/dc' },
    { id: 'senate-dc', label: 'U.S. Senate', url: 'https://www.senate.gov/dc' },
  ],
  relatedEntityIds: [],
  contributors: [{ id: 'neo', name: 'Neo', kind: 'editorial', roles: ['author'] }],
};

const CHAPTER: PublicStoryProjectionDoc = {
  ...LINCOLN,
  id: 'story_buying_a_home',
  slug: 'buying-a-home',
  format: 'chapter',
  title: 'Buying a Home',
  collection: undefined,
  publishedAt: '2026-07-26',
};

function deps(): HandlerDeps {
  return {
    dataAccess: createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [],
      stories: [toStoryV1(LINCOLN), toStoryV1(CHAPTER)],
    }),
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => 1_800_000_000_000 }),
    searchGuard: createPublicSearchGuard(),
  };
}

const request = (path: string): ApiRequest => ({
  method: 'GET',
  path,
  query: new URLSearchParams(),
  headers: { 'x-blackstory-client': 'mobile/1.4.0; api=1' },
  requestId: 'req_story',
});

test('inline markup becomes flat runs; cites number by source order, unknown refs drop', () => {
  const cite = new Map([
    ['nara-dc', 1],
    ['senate-dc', 2],
  ]);
  assert.deepEqual(
    toRuns('He signed **the act** at [[ent_dc|the capital]].[ref:nara-dc][ref:missing]', cite),
    [
      { t: 'text', text: 'He signed ' },
      { t: 'text', text: 'the act', strong: true },
      { t: 'text', text: ' at ' },
      { t: 'text', text: 'the capital', entityId: 'ent_dc' },
      { t: 'text', text: '.' },
      { t: 'cite', n: 1, refId: 'nara-dc' },
    ],
  );
});

test('a story maps to the wire contract without internal fields', () => {
  const story = storyV1Schema.parse(toStoryV1(LINCOLN));
  assert.equal(story.webPath, '/presidents/abraham-lincoln');
  assert.deepEqual(story.body[3], {
    type: 'webOnly',
    kind: 'figure',
    caption: 'Wealth per person',
  });
  assert.deepEqual(story.body[4], {
    type: 'record',
    entityId: 'ent_greenwood',
    label: 'Open the record',
  });
  const wire = JSON.stringify(story);
  for (const leaked of ['objectPath', 'rightsStatus', 'packetId', 'pkt_1', 'story_potus']) {
    assert.ok(!wire.includes(leaked), `${leaked} leaked onto the wire`);
  }
  assert.equal(toStoryV1(CHAPTER).webPath, '/stories/buying-a-home');
});

test('GET /v1/stories lists every story without bodies', async () => {
  const res = await dispatch(request('/v1/stories'), deps());
  assert.equal(res.status, 200);
  const body = storiesResponseV1Schema.parse(res.body);
  assert.deepEqual(
    body.stories.map((story) => story.slug),
    ['abraham-lincoln', 'buying-a-home'],
  );
  assert.ok(!JSON.stringify(res.body).includes('"body"'), 'the list carries no bodies');
});

test('GET /v1/stories/{slug} returns the story; unknown slugs 404, malformed 400', async () => {
  const ok = await dispatch(request('/v1/stories/abraham-lincoln'), deps());
  assert.equal(ok.status, 200);
  assert.equal(storyV1Schema.parse(ok.body).references.length, 2);

  const missing = await dispatch(request('/v1/stories/no-such-story'), deps());
  assert.equal(missing.status, 404);

  const malformed = await dispatch(request('/v1/stories/..%2Fetc'), deps());
  assert.equal(malformed.status, 400);
});

test('stories share the released-catalog quota class', () => {
  assert.equal(resolvePublicEndpointClass('/v1/stories', 'GET'), 'entityRetrieval');
  assert.equal(resolvePublicEndpointClass('/v1/stories/abraham-lincoln', 'GET'), 'entityRetrieval');
});

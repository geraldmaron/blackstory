/**
 * Tests for public story projection Zod schemas: theme-chapter binding and
 * per-section data-moment / dispute anchors (repo-cqey.2).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicEntityProjectionSchema, publicStoryProjectionSchema } from './public-projections.ts';

const baseStory = {
  id: 'story-1',
  releaseId: 'release-1',
  slug: 'a-legacy-story',
  title: 'A Legacy Story',
  dek: 'A brief description of the story.',
  publishedAt: '2026-07-01',
  eraLabel: 'Reconstruction',
  placeLabel: 'Baltimore, MD',
  body: [
    {
      heading: 'Origins',
      paragraphs: ['First paragraph.', 'Second paragraph.'],
    },
  ],
  relatedEntityIds: ['entity-1'],
  sources: [{ label: 'Primary source', url: 'https://example.com/source' }],
};

test('legacy story with none of the new fields still parses', () => {
  const result = publicStoryProjectionSchema.safeParse(baseStory);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.themeBinding, undefined);
    assert.equal(result.data.body[0]?.moments, undefined);
    assert.equal(result.data.body[0]?.disputes, undefined);
  }
});

test('valid chapter binding parses', () => {
  const withBinding = {
    ...baseStory,
    themeBinding: {
      themeId: 'redlining',
      chapterIndex: 1,
      chapterCount: 3,
    },
    body: [
      {
        heading: 'Origins',
        paragraphs: ['First paragraph.'],
        moments: [
          {
            packetId: 'tip_fixture_redlining_q3_baltimore',
            kind: 'observation' as const,
            refId: 'obs_fixture_homeownership_black',
            placement: 'after' as const,
          },
        ],
        disputes: [
          {
            label: 'Cause of decline',
            sideA: { sourceLabel: 'Source A', claim: 'Policy X caused decline.' },
            sideB: { sourceLabel: 'Source B', claim: 'Market forces caused decline.' },
          },
        ],
      },
    ],
  };

  const result = publicStoryProjectionSchema.safeParse(withBinding);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.themeBinding?.themeId, 'redlining');
    assert.equal(result.data.body[0]?.moments?.[0]?.refId, 'obs_fixture_homeownership_black');
    assert.equal(result.data.body[0]?.disputes?.[0]?.label, 'Cause of decline');
  }
});

test('invalid themeId is rejected', () => {
  const withInvalidBinding = {
    ...baseStory,
    themeBinding: {
      themeId: 'not_a_real_theme',
      chapterIndex: 1,
      chapterCount: 3,
    },
  };

  const result = publicStoryProjectionSchema.safeParse(withInvalidBinding);
  assert.equal(result.success, false);
});

test('moment refId is required', () => {
  const withMissingRefId = {
    ...baseStory,
    body: [
      {
        heading: 'Origins',
        paragraphs: ['First paragraph.'],
        moments: [
          {
            packetId: 'tip_fixture_redlining_q3_baltimore',
            kind: 'observation' as const,
            placement: 'after' as const,
          },
        ],
      },
    ],
  };

  const result = publicStoryProjectionSchema.safeParse(withMissingRefId);
  assert.equal(result.success, false);
});

/**
 * repo-n7p6.26 — a read-side length check must never unpublish a record.
 *
 * `summary` was capped at 400 here while the wire contract (`entityV1Schema`) allows 5000. The
 * result was not a truncated summary: `parseEntityProjection` returned undefined and the record
 * disappeared from the API and the website both. It hit the 9 best-enriched records in the active
 * release, because richer enrichment writes longer summaries.
 */
const baseEntity = {
  id: 'ent_test_001',
  releaseId: 'release-1',
  kind: 'person',
  displayName: 'Test Person',
  nameLower: 'test person',
  summary: 'S'.repeat(140),
};

test('entity projection accepts a summary longer than the old 400-char cap', () => {
  // 613 chars: the real length of the James Baldwin summary that used to 404 the record.
  const result = publicEntityProjectionSchema.safeParse({
    ...baseEntity,
    summary: 'S'.repeat(613),
  });
  assert.equal(result.success, true);
});

test('entity projection still rejects a summary below the 120-char substance floor', () => {
  const result = publicEntityProjectionSchema.safeParse({ ...baseEntity, summary: 'Too short.' });
  assert.equal(result.success, false);
});

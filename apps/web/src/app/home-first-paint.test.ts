/**
 * First paint loads a featured set by id, never the release-wide catalog.
 * The place is the page: no schema strip, no grade, no precision leak.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { FEATURED_SEED_IDS, getPublicEntity } from '../data/public-seed';
import { buildEntityAnatomyInputs } from './entity/[id]/entity-anatomy-facts';
import { HomeFirstPaint } from './HomeFirstPaint';
import { HOME_FEATURED_ENTITY_IDS, isInternalRecordLabel, pickHomeStory } from './home-first-paint';

function storyDoc(overrides: Partial<PublicArticleListItemDoc> = {}): PublicArticleListItemDoc {
  return {
    slug: 'the-count',
    title: 'Chapter: The Count',
    summary: 'The United States has been writing Black people down.',
    placeLabel: 'United States',
    eraLabel: '1787–present',
    kind: 'chapter',
    publishedAt: '2026-08-01',
    releaseId: 'rel_test',
    id: 'art_count',
    tags: [],
    ...overrides,
  } as PublicArticleListItemDoc;
}

test('the featured set prefers Greenwood, then the two seed places', () => {
  assert.deepEqual(
    [...HOME_FEATURED_ENTITY_IDS],
    ['ent_greenwood_district_001', 'ent_dunbar_school_001', 'ent_15th_st_church_001'],
  );
  assert.ok(FEATURED_SEED_IDS.includes(HOME_FEATURED_ENTITY_IDS[1]));
  assert.ok(FEATURED_SEED_IDS.includes(HOME_FEATURED_ENTITY_IDS[2]));
  assert.ok(getPublicEntity(HOME_FEATURED_ENTITY_IDS[1]));
  assert.ok(getPublicEntity(HOME_FEATURED_ENTITY_IDS[2]));
});

test('the loader never asks for the full catalog', () => {
  const source = readFileSync(new URL('./home-first-paint.ts', import.meta.url), 'utf8');
  assert.match(source, /listPublicEntityViewsByIds/);
  assert.doesNotMatch(source, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(source, /\/atlas\/catalog/);
});

test('internal ids never title first paint', () => {
  assert.equal(isInternalRecordLabel('42Cb1758'), true);
  assert.equal(isInternalRecordLabel('ent_dunbar_school_001'), true);
  assert.equal(isInternalRecordLabel(''), true);
  assert.equal(isInternalRecordLabel('Greenwood District'), false);
  assert.equal(isInternalRecordLabel('Paul Laurence Dunbar High School'), false);
  assert.equal(isInternalRecordLabel('Chapter: The Count'), false);
});

test('pickHomeStory prefers a Tulsa story when one is already published, and invents nothing', () => {
  const count = storyDoc();
  const tulsa = storyDoc({
    slug: 'the-gap-that-never-closed',
    title: 'The gap that never closed',
    summary: 'Greenwood after 1921.',
    placeLabel: 'Tulsa, Oklahoma',
    id: 'art_gap',
  });
  assert.equal(pickHomeStory([count, tulsa])?.slug, 'the-gap-that-never-closed');
  assert.equal(pickHomeStory([count])?.slug, 'the-count');
  assert.equal(pickHomeStory([storyDoc({ title: '42Cb1758', slug: 'opaque' })]), undefined);
});

test('the door steals about copy, and does not invent a slogan', () => {
  const paint = readFileSync(new URL('./HomeFirstPaint.tsx', import.meta.url), 'utf8');
  assert.match(paint, /ABOUT_WALK_PAST/);
  assert.match(paint, /ABOUT_ON_THE_GROUND/);
  assert.match(paint, /ABOUT_LINE/);
  assert.doesNotMatch(paint, /History happened/);
});

test('first paint never mounts the catalog boot, camera cockpit, or Journey page', () => {
  const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
  const paint = readFileSync(
    fileURLToPath(new URL('./HomeFirstPaint.tsx', import.meta.url)),
    'utf8',
  );
  const loader = readFileSync(new URL('./explore/AtlasLoader.tsx', import.meta.url), 'utf8');
  const imports = page
    .split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
  assert.match(page, /HomeFirstPaint/);
  assert.match(page, /loadHomeFirstPaint/);
  assert.doesNotMatch(page, /wantsAtlasInstrument|AtlasHome|atlas=1/);
  assert.doesNotMatch(imports, /getSharedPublicEntities|AtlasLoader|atlas\/catalog|explore\.css/);
  assert.doesNotMatch(page, /Loading \{shell\.totalMatched/);
  assert.doesNotMatch(paint, /CameraConsole|Orbit|Tilt|Trace/);
  assert.doesNotMatch(paint, /Loading 4,101|\/journey|42Cb1758/);
  assert.doesNotMatch(loader, /Loading \{shell\.totalMatched|4,101 records/);
});

test('first paint is the place, not a schema card', () => {
  const paint = readFileSync(new URL('./HomeFirstPaint.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(
    paint,
    /RecordAnatomyPanel|buildEntityAnatomy|evidenceLabel|record-evidence|RoomHeader|RoomCard/,
  );
  assert.doesNotMatch(paint, /Grade A|2 sources|radius affordance|Shown at locality/);
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const greenwoodShaped = {
    ...dunbar,
    displayName: 'Greenwood District',
    claims: dunbar.claims.slice(0, 2),
  };
  assert.equal(
    buildEntityAnatomyInputs(greenwoodShaped, undefined).evidenceLabel,
    'Grade A · 2 sources',
  );
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: greenwoodShaped, also: [], story: undefined, source: 'live' },
    }),
  );
  assert.match(html, /<h1[^>]*>[\s\S]*Greenwood District/);
  assert.match(html, /ds-home-place/);
  assert.match(html, /walk past documented Black history/);
  assert.match(html, /not a remote museum shelf/);
  assert.match(html, /place-connected archive/);
  assert.doesNotMatch(html, /Grade A|Grade B|Grade C/);
  assert.doesNotMatch(html, /\d+ sources?|independent sources/i);
  assert.doesNotMatch(html, />Kind<|>Where<|>Era<|>Evidence</);
  assert.doesNotMatch(html, /radius affordance|Shown at locality|precisionCaption/i);
  assert.doesNotMatch(html, /Journey|42Cb1758|4,101|Orbit|Tilt|Trace/);
});

test('HomeFirstPaint never titles or lists an internal id, even if the model carries one', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: {
        lead: { ...dunbar, displayName: '42Cb1758' },
        also: [{ ...dunbar, id: 'ent_opaque_also', displayName: '42Cb1758' }],
        story: storyDoc({
          slug: 'the-gap-that-never-closed',
          title: 'The gap that never closed',
          summary: 'Greenwood after 1921.',
          placeLabel: 'Tulsa, Oklahoma',
          id: 'art_gap',
        }),
        source: 'live',
      },
    }),
  );
  assert.doesNotMatch(html, /42Cb1758/);
  assert.match(html, /The gap that never closed/);
  assert.match(html, /place-connected archive/);
});

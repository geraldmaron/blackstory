/**
 * First paint loads one published record by id, never the release-wide catalog.
 * The place is that record. Rooms exist only when this record already has material.
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

test('the loader loads one record, never the full catalog', () => {
  const source = readFileSync(new URL('./home-first-paint.ts', import.meta.url), 'utf8');
  assert.match(source, /resolvePublicEntityView/);
  assert.doesNotMatch(source, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(source, /\/atlas\/catalog|getPublicSearchIndex/);
});

test('internal ids never title first paint', () => {
  assert.equal(isInternalRecordLabel('42Cb1758'), true);
  assert.equal(isInternalRecordLabel('ent_dunbar_school_001'), true);
  assert.equal(isInternalRecordLabel('ent_greenwood_district_001_claim_0'), true);
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
  assert.doesNotMatch(paint, /Open the full record/);
  assert.doesNotMatch(loader, /Loading \{shell\.totalMatched|4,101 records/);
});

test('first paint is the record, not a manifesto or a schema card', () => {
  const paint = readFileSync(new URL('./HomeFirstPaint.tsx', import.meta.url), 'utf8');
  assert.match(paint, /EntityRoomSections|ds-record-mast/);
  assert.doesNotMatch(paint, /ABOUT_LINE|ABOUT_WALK_PAST|ABOUT_ON_THE_GROUND|ABOUT_PILLARS/);
  assert.doesNotMatch(
    paint,
    /RecordAnatomyPanel|buildEntityAnatomy|evidenceLabel|RoomHeader|toEvidenceClaimInputs/,
  );
  assert.doesNotMatch(paint, /ds-record-strip|Grade A|radius affordance|Shown at locality/);
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const greenwoodShaped = {
    ...dunbar,
    displayName: 'Greenwood District',
    summary: 'Thirty-five blocks of Greenwood, destroyed in the 1921 Tulsa massacre, then rebuilt.',
    historicalContext:
      'Greenwood was a Black commercial district in Tulsa. In 1921 a massacre burned it. The district rebuilt.',
    claims: dunbar.claims.slice(0, 2),
    locationLabel: 'Greenwood, Tulsa (neighborhood-level pin)',
    jurisdictionLabel: 'Tulsa, Oklahoma',
    timeline: [
      {
        id: 'ent_greenwood_district_001_status_0',
        time: '1921',
        datePrecision: 'year' as const,
        title: 'Status: Historic',
        body: 'In effect from 1921. Basis: ent_greenwood_district_001_claim_0.',
      },
      {
        id: 'leak-title',
        time: '1921',
        datePrecision: 'year' as const,
        title: 'ent_greenwood_district_001_claim_0',
        body: 'Should never print.',
      },
    ],
    relatedNeighbors: [
      {
        id: 'ent_vernon_ame_001',
        displayName: 'Vernon AME Church',
        kind: 'place' as const,
        summary: 'A church in Greenwood.',
        relationType: 'located_at',
        direction: 'incoming' as const,
      },
    ],
    continueLearning: [],
    primaryImage: undefined,
  };
  assert.equal(
    buildEntityAnatomyInputs(greenwoodShaped, undefined).evidenceLabel,
    'Grade A · 2 sources',
  );
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: greenwoodShaped, also: [], story: undefined, citing: [], source: 'live' },
    }),
  );
  assert.match(html, /<h1[^>]*>[\s\S]*Greenwood District/);
  assert.match(html, /ds-record-mast/);
  assert.match(html, /Thirty-five blocks of Greenwood/);
  assert.match(html, /The history here/);
  assert.match(html, /1921/);
  assert.match(html, /Vernon AME Church/);
  assert.match(html, /Tulsa, Oklahoma/);
  assert.match(html, />Places</);
  assert.doesNotMatch(html, /id="stories"/);
  assert.doesNotMatch(html, /href="#stories"/);
  assert.doesNotMatch(html, /Records this one touches|this one/);
  assert.doesNotMatch(html, /Active|Current status|In effect from|Status and history/);
  assert.doesNotMatch(html, /walk past documented Black history/);
  assert.doesNotMatch(html, /place-connected archive of Black history/);
  assert.doesNotMatch(html, /Grade A|Grade B|Grade C/);
  assert.doesNotMatch(html, /Grade A · \d+ sources?|independent sources/i);
  assert.doesNotMatch(html, />Kind<|>Where<|>Era<|>Evidence</);
  assert.doesNotMatch(html, /radius affordance|Shown at locality/i);
  assert.doesNotMatch(html, /Journey|42Cb1758|4,101|Orbit|Tilt|Trace/);
  assert.doesNotMatch(html, /ent_greenwood_district_001_claim_0/);
  assert.doesNotMatch(html, /rights-cleared|awaits a/i);
  assert.doesNotMatch(html, /from their record/i);
  assert.doesNotMatch(html, /Open the full record/);
  assert.doesNotMatch(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.doesNotMatch(html, /href="\/stories"/);
  assert.doesNotMatch(html, /href="\/law"/);
  assert.doesNotMatch(html, /href="\/data"/);
  assert.doesNotMatch(html, /href="\/memorial"/);
});

test('seed Dunbar first paint has no claim ids, rights caption, or national rooms', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: dunbar, also: [], story: undefined, citing: [], source: 'seed' },
    }),
  );
  assert.match(html, /Paul Laurence Dunbar High School/);
  assert.match(html, /The history here/);
  assert.doesNotMatch(html, /href="#stories"/);
  assert.doesNotMatch(html, /Records this one touches|this one/);
  assert.doesNotMatch(html, /Active|Current status|In effect from|Status and history/);
  assert.doesNotMatch(html, /ent_[a-z0-9_]+_claim_\d+/i);
  assert.doesNotMatch(html, /claim_dunbar_/);
  assert.doesNotMatch(html, /rights-cleared|awaits a/i);
  assert.doesNotMatch(html, /from their record/i);
  assert.doesNotMatch(html, /Open the full record/);
  assert.doesNotMatch(html, /href="\/stories"/);
  assert.doesNotMatch(html, /href="\/law"/);
  assert.doesNotMatch(html, /href="\/data"/);
  assert.doesNotMatch(html, /href="\/memorial"/);
});

test('Stories is citing chapters, or there is no Stories button', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const greenwood = {
    ...dunbar,
    displayName: 'Greenwood District',
    summary: 'Thirty-five blocks of Greenwood, destroyed in the 1921 Tulsa massacre, then rebuilt.',
    historicalContext: 'Greenwood was a Black commercial district in Tulsa.',
  };
  const without = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: greenwood, also: [], story: undefined, citing: [], source: 'live' },
    }),
  );
  assert.match(without, /The history here/);
  assert.doesNotMatch(without, /href="#stories"/);
  assert.doesNotMatch(without, />Stories</);

  const withChapter = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: {
        lead: greenwood,
        also: [],
        story: undefined,
        citing: [
          {
            slug: 'the-gap-that-never-closed',
            title: 'The gap that never closed',
            relation: 'mapped in',
            href: '/stories/the-gap-that-never-closed',
          },
        ],
        source: 'live',
      },
    }),
  );
  assert.match(withChapter, /id="stories"/);
  assert.match(withChapter, /href="#stories"/);
  assert.match(withChapter, /The gap that never closed/);
  assert.match(withChapter, /href="\/stories\/the-gap-that-never-closed"/);
  assert.doesNotMatch(withChapter, /href="\/stories"/);
});

test('HomeFirstPaint never titles or lists an internal id, even if the model carries one', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: {
        lead: { ...dunbar, displayName: '42Cb1758' },
        also: [],
        story: storyDoc({
          slug: 'the-gap-that-never-closed',
          title: 'The gap that never closed',
          summary: 'Greenwood after 1921.',
          placeLabel: 'Tulsa, Oklahoma',
          id: 'art_gap',
        }),
        citing: [],
        source: 'live',
      },
    }),
  );
  assert.doesNotMatch(html, /42Cb1758/);
  assert.match(html, /The gap that never closed/);
  assert.doesNotMatch(html, /href="\/stories"/);
  assert.match(html, /href="\/stories\/the-gap-that-never-closed"/);
});

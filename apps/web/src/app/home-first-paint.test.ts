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
import { FEATURED_SEED_IDS, getPublicEntity, listPublicEntities } from '../data/public-seed';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { isTulsaPlace, placeHref } from '../lib/place/public-place-path';
import { buildEntityAnatomyInputs } from './entity/[id]/entity-anatomy-facts';
import { HomeFirstPaint } from './HomeFirstPaint';
import {
  HOME_FEATURED_ENTITY_IDS,
  isInternalRecordLabel,
  loadHomeFirstPaint,
  pickHomeStory,
} from './home-first-paint';

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

test('the featured set prefers non-Tulsa places; Greenwood is last-resort', () => {
  assert.deepEqual(
    [...HOME_FEATURED_ENTITY_IDS],
    [
      'ent_aarlcc_fort_lauderdale_001',
      'nrhp-black-heritage-91000107',
      'nrhp-black-heritage-100001861',
      'ent_dunbar_school_001',
      'ent_15th_st_church_001',
      'ent_greenwood_district_001',
    ],
  );
  assert.equal(HOME_FEATURED_ENTITY_IDS.at(-1), 'ent_greenwood_district_001');
  assert.ok(FEATURED_SEED_IDS.includes('ent_dunbar_school_001'));
  assert.ok(FEATURED_SEED_IDS.includes('ent_15th_st_church_001'));
  assert.ok(getPublicEntity('ent_dunbar_school_001'));
  assert.ok(getPublicEntity('ent_15th_st_church_001'));
});

test('every /place/ href on the seed map source holds on the place page', async () => {
  const source = buildExploreMapSource(listPublicEntities());
  const placeHrefs = source.featureCollection.features
    .map((feature) => feature.properties.href)
    .filter((href) => href.startsWith('/place/'));
  assert.ok(placeHrefs.length > 0);
  for (const href of placeHrefs) {
    const slug = href.slice('/place/'.length);
    const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
    assert.ok(model.lead, `${href} must hold`);
    assert.doesNotMatch(href, /archie-edwards|barnett-aden|industrial-bank|whitelaw/);
  }
});

test('the loader stands away from Tulsa, or at a named slug', async () => {
  const home = await loadHomeFirstPaint();
  assert.ok(home.lead);
  assert.equal(isTulsaPlace(home.lead), false);
  assert.doesNotMatch(home.lead.displayName, /tulsa|greenwood/i);
  assert.ok(home.also.length > 0);
  assert.ok(home.also.every((place) => place.id !== home.lead?.id));
  assert.ok(home.also.every((place) => !isTulsaPlace(place)));
  assert.ok(home.also.every((place) => !placeHref(place.displayName).includes('ent_')));
  assert.ok(
    home.also.some((place) => place.displayName === 'Fifteenth Street Presbyterian Church'),
  );

  const church = await loadHomeFirstPaint({
    namedSlug: 'fifteenth-street-presbyterian-church',
    requireNamed: true,
  });
  assert.equal(church.lead?.displayName, 'Fifteenth Street Presbyterian Church');

  const missing = await loadHomeFirstPaint({
    namedSlug: 'no-such-place',
    requireNamed: true,
  });
  assert.equal(missing.lead, undefined);
});

test('the loader loads one record, never the full catalog', () => {
  const source = readFileSync(new URL('./home-first-paint.ts', import.meta.url), 'utf8');
  assert.match(source, /resolvePublicEntityView/);
  assert.match(source, /getPublicSearchIndex/);
  assert.doesNotMatch(source, /getSharedPublicEntities|listPublicEntityViews\(/);
  assert.doesNotMatch(source, /\/atlas\/catalog/);
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

test('pickHomeStory follows published order and invents nothing', () => {
  const count = storyDoc();
  const tulsa = storyDoc({
    slug: 'the-gap-that-never-closed',
    title: 'The gap that never closed',
    summary: 'Greenwood after 1921.',
    placeLabel: 'Tulsa, Oklahoma',
    publishedAt: '2026-07-01',
    id: 'art_gap',
  });
  assert.equal(pickHomeStory([count, tulsa])?.slug, 'the-count');
  assert.equal(pickHomeStory([count])?.slug, 'the-count');
  assert.equal(pickHomeStory([storyDoc({ title: '42Cb1758', slug: 'opaque' })]), undefined);
});

test('`/` is the door; a place page never mounts the catalog boot or camera cockpit', () => {
  const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
  const paint = readFileSync(
    fileURLToPath(new URL('./HomeFirstPaint.tsx', import.meta.url)),
    'utf8',
  );
  const loader = readFileSync(new URL('./explore/AtlasLoader.tsx', import.meta.url), 'utf8');
  const atlas = readFileSync(
    fileURLToPath(new URL('./explore/AtlasExperience.tsx', import.meta.url)),
    'utf8',
  );
  const mapSource = readFileSync(
    fileURLToPath(new URL('../lib/map-experience/build-explore-map-source.ts', import.meta.url)),
    'utf8',
  );
  const imports = page
    .split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
  assert.match(page, /DoorHome/);
  assert.match(imports, /DoorHome/);
  assert.doesNotMatch(page, /AtlasHome|AtlasLoader|HomeFirstPaint|wantsAtlasInstrument|atlas=1/);
  assert.doesNotMatch(page, /Loading \{shell\.totalMatched/);
  assert.doesNotMatch(paint, /CameraConsole|Orbit|Tilt|Trace/);
  assert.doesNotMatch(paint, /Loading 4,101|\/journey|42Cb1758/);
  assert.doesNotMatch(paint, /Open the full record/);
  assert.match(paint, /MAP_BACK|BlackStory/);
  assert.doesNotMatch(loader, /Loading \{shell\.totalMatched|4,101 records/);
  assert.doesNotMatch(loader, /Opening the map/);
  assert.match(loader, /firstPaintCatalog/);
  assert.match(loader, /readonly pins/);
  assert.match(mapSource, /instrumentRecordHref|atlasWalkHref/);
  assert.doesNotMatch(mapSource, /href: `\/entity\/\$\{entity\.id\}`/);
  assert.match(atlas, /atlasWalkHref|isHoldingPlaceHref/);
  assert.doesNotMatch(atlas, /\/entity\/\$\{record\.id\}/);
  assert.doesNotMatch(atlas, /recordCount=\{view\.allFeatures\.length\}/);
  const commandBar = readFileSync(
    fileURLToPath(new URL('../components/shell/CommandBar.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(commandBar, /Search records, places, eras/);
  assert.doesNotMatch(commandBar, /toLocaleString/);
  const atlasHome = readFileSync(
    fileURLToPath(new URL('./atlas-home.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(atlasHome, /toFirstPaintPins/);
  assert.match(atlasHome, /FirstPaintPinPlate/);
  assert.match(atlasHome, /ExploreMapUnderlay/);
  assert.doesNotMatch(atlasHome, /Opening the map/);
  assert.doesNotMatch(atlasHome, /ds-explore__walks/);
});

test('first paint is the record, not a manifesto or a schema card', () => {
  const paint = readFileSync(new URL('./HomeFirstPaint.tsx', import.meta.url), 'utf8');
  assert.match(paint, /EntityRoomSections|ds-record-mast/);
  assert.match(paint, /toEvidenceClaimInputs/);
  assert.match(paint, /Can I trust this|id="trust"/);
  assert.match(paint, /placeDiscoveryReturn|See this place on the Atlas|mapLabel/);
  assert.doesNotMatch(paint, /ABOUT_LINE|ABOUT_WALK_PAST|ABOUT_ON_THE_GROUND|ABOUT_PILLARS/);
  assert.doesNotMatch(paint, /RecordAnatomyPanel|buildEntityAnatomy|evidenceLabel|RoomHeader/);
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
  };
  delete (greenwoodShaped as { primaryImage?: unknown }).primaryImage;
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
  assert.match(html, /What the sources say/);
  assert.match(html, /1921/);
  assert.match(html, /Vernon AME Church/);
  assert.match(html, /href="\/place\/vernon-ame-church"/);
  assert.match(html, /Tulsa, Oklahoma/);
  assert.match(html, />Places</);
  assert.match(html, /href="\/data"/);
  assert.match(html, /href="\/law"/);
  assert.match(html, /href="\/memorial"/);
  assert.match(html, /href="\/methodology"/);
  assert.match(html, /href="\/errata"/);
  assert.match(html, />BlackStory</);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /id="stories"/);
  assert.doesNotMatch(html, /href="#stories"/);
  assert.doesNotMatch(html, /href="\/books"/);
  assert.doesNotMatch(html, /Records this one touches|this one/);
  assert.doesNotMatch(html, /Active|Current status|In effect from|Status and history/);
  assert.doesNotMatch(html, /walk past documented Black history/);
  assert.doesNotMatch(html, /place-connected archive of Black history/);
  assert.doesNotMatch(html, /Grade A|Grade B|Grade C/);
  assert.doesNotMatch(html, />Kind<|>Where<|>Era<|>Evidence</);
  assert.doesNotMatch(html, /radius affordance|Shown at locality/i);
  assert.doesNotMatch(html, /Journey|42Cb1758|4,101|Orbit|Tilt|Trace/);
  assert.doesNotMatch(html, /ent_greenwood_district_001_claim_0/);
  assert.doesNotMatch(html, /rights-cleared|awaits a/i);
  assert.doesNotMatch(html, /from their record/i);
  assert.doesNotMatch(html, /Open the full record/);
  assert.doesNotMatch(html, /href="\/entity\//);
  assert.doesNotMatch(html, /href="\/stories"/);
  assert.doesNotMatch(html, /Open a room from this place/);
  assert.doesNotMatch(html, /not a photograph|symbolic mark/i);
  assert.doesNotMatch(html, /Banned books|\/banned-books/);
  assert.doesNotMatch(
    html,
    /neighborhood-level pin|locality precision|radius affordance|campus-level pin/i,
  );
});

test('seed Dunbar place record shows sourced claims without catalog chrome', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  assert.ok(dunbar);
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: dunbar, also: [], story: undefined, citing: [], source: 'seed' },
    }),
  );
  assert.match(html, /Paul Laurence Dunbar High School/);
  assert.match(html, /The history here/);
  assert.match(html, /What the sources say/);
  assert.match(html, /Can I trust this/);
  assert.match(html, /See this place on the Atlas|Browse the record list/);
  assert.match(html, /href="\/place\/fifteenth-street-presbyterian-church"/);
  assert.match(html, /href="\/place\/dunbar-alumni-federation"/);
  assert.match(html, /href="\/data"/);
  assert.match(html, /href="\/law"/);
  assert.match(html, /href="\/memorial"/);
  assert.match(html, /href="\/methodology"/);
  assert.match(html, /href="\/errata"/);
  assert.doesNotMatch(html, /href="#stories"/);
  assert.doesNotMatch(html, /href="\/books"/);
  assert.doesNotMatch(html, /Records this one touches|this one/);
  assert.doesNotMatch(html, /Active|Current status|In effect from|Status and history/);
  assert.doesNotMatch(html, /rights-cleared|awaits a/i);
  assert.doesNotMatch(html, /from their record/i);
  assert.doesNotMatch(html, /Open the full record/);
  assert.doesNotMatch(html, /href="\/entity\//);
  assert.doesNotMatch(html, /href="\/stories"/);
  assert.doesNotMatch(html, /Open a room from this place/);
  assert.doesNotMatch(html, /not a photograph|symbolic mark/i);
  assert.doesNotMatch(html, /Banned books|\/banned-books/);
  assert.doesNotMatch(
    html,
    /neighborhood-level pin|locality precision|radius affordance|campus-level pin/i,
  );
});

test('the church locator names the place, not a pin taxonomy', () => {
  const church = getPublicEntity('ent_15th_st_church_001');
  assert.ok(church);
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: { lead: church, also: [], story: undefined, citing: [], source: 'seed' },
    }),
  );
  assert.match(html, /Fifteenth Street Presbyterian Church, Washington, D\.C\./);
  assert.match(html, /href="\/place\/paul-laurence-dunbar-high-school"/);
  assert.match(html, /ds-record-visit/);
  assert.doesNotMatch(html, /neighborhood-level pin|locality precision|radius affordance/i);
  assert.doesNotMatch(html, /Open a room from this place/);
  assert.doesNotMatch(html, /not a photograph|symbolic mark/i);
  assert.doesNotMatch(html, /Banned books|\/banned-books/);
  assert.doesNotMatch(html, /id="stories"/);
  assert.doesNotMatch(html, /href="\/stories"/);
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
  assert.doesNotMatch(withChapter, /href="\/stories"(?![/\w-])/);
  assert.doesNotMatch(withChapter, /href="\/books"/);
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

test('a place with no place neighbors walks on to another published stand', () => {
  const dunbar = getPublicEntity('ent_dunbar_school_001');
  const church = getPublicEntity('ent_15th_st_church_001');
  assert.ok(dunbar);
  assert.ok(church);
  const library = {
    ...dunbar,
    id: 'ent_aarlcc_fort_lauderdale_001',
    displayName: 'African American Research Library and Cultural Center',
    summary: 'A research library and cultural center in Fort Lauderdale.',
    historicalContext: 'The library holds research collections in Fort Lauderdale.',
    relatedNeighbors: [],
    continueLearning: [],
  };
  const dillard = {
    ...church,
    id: 'nrhp-black-heritage-91000107',
    displayName: 'Dillard High School, Old',
    relatedNeighbors: [],
    continueLearning: [],
  };
  const html = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: {
        lead: library,
        also: [church, dillard],
        story: undefined,
        citing: [],
        source: 'live',
      },
    }),
  );
  assert.match(html, /African American Research Library and Cultural Center/);
  assert.match(html, />BlackStory</);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/place\/fifteenth-street-presbyterian-church"/);
  assert.match(html, /href="\/place\/dillard-high-school-old"/);
  assert.doesNotMatch(html, /id="stories"/);
  assert.doesNotMatch(html, /href="#stories"/);
  assert.doesNotMatch(html, /Open a room from this place/);
  assert.doesNotMatch(html, /not a photograph|symbolic mark/i);
  assert.doesNotMatch(html, /Banned books|\/banned-books/);
  assert.doesNotMatch(html, /href="\/entity\//);
  assert.doesNotMatch(html, /href="\/stories"/);

  const withNeighbor = renderToStaticMarkup(
    createElement(HomeFirstPaint, {
      model: {
        lead: dunbar,
        also: [
          {
            ...church,
            id: 'nrhp-black-heritage-91000107',
            displayName: 'Dillard High School, Old',
          },
        ],
        story: undefined,
        citing: [],
        source: 'seed',
      },
    }),
  );
  assert.match(withNeighbor, /href="\/place\/fifteenth-street-presbyterian-church"/);
  assert.match(withNeighbor, /href="\/place\/dillard-high-school-old"/);
});

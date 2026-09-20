/**
 * Reader-surface contracts for Lives: publish complete material additively and keep retired
 * dimensions out of the interface.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LivesWorldBeats } from './LivesWorldBeats';

void React;

const here = path.dirname(fileURLToPath(import.meta.url));

test('an unfinished decade-world catalog renders no placeholder section', () => {
  const html = renderToStaticMarkup(<LivesWorldBeats decade={1930} beats={[]} emphasis="black" />);
  assert.equal(html, '');
});

test('the reader surface keeps retired unit and tier dimensions out of its controls', () => {
  const timeline = readFileSync(path.join(here, 'LivesTimeline.tsx'), 'utf8');
  assert.doesNotMatch(timeline, /name="lives-unit"|name="lives-tier"/);
  assert.doesNotMatch(timeline, /LIVES_UNITS|LIVES_TIER_PARAMS/);
});

test('the public reader is milestone-led while the decade grid lives in the appendix', () => {
  const reader = readFileSync(path.join(here, '../../app/lives/page.tsx'), 'utf8');
  const milestone = readFileSync(path.join(here, 'LivesMilestoneExperience.tsx'), 'utf8');
  const explorer = readFileSync(path.join(here, '../../app/lives/explorer/page.tsx'), 'utf8');
  assert.match(reader, /LivesMilestoneExperience/);
  assert.doesNotMatch(reader, /LivesTimeline|LivesDecadeRail|LivesAreaNav/);
  assert.doesNotMatch(milestone, /Not yet counted|Not published|ready to publish/);
  assert.match(explorer, /LivesTimeline/);
  assert.match(explorer, /Evidence appendix/);
});

test('the visible law section is rules that began, not the unbounded in-force wall', () => {
  const rules = readFileSync(path.join(here, 'LivesRulesInForce.tsx'), 'utf8');
  assert.match(rules, /Rules that began in the/);
  assert.match(rules, /rule\.inForceFromYear >= decade\.decade/);
  assert.doesNotMatch(rules, /Rules in force in the/);
});

test('a rule card says what the rule did and what followed, and links to its record', async () => {
  const { LivesRuleCard } = await import('./LivesRuleCard');
  const html = renderToStaticMarkup(
    <ul>
      <LivesRuleCard
        rule={{
          id: 'fha-1968-us',
          entityId: 'ent_law_fair_housing_act_1968',
          name: 'Fair Housing Act of 1968',
          href: '/entity/ent_law_fair_housing_act_1968',
          scopeLevel: 'federal',
          jurisdictionLabel: 'Federal',
          inForceFromYear: 1968,
          inForceToYear: null,
          appliesTo: ['black', 'white', 'hispanic'],
          groupsNamed: [],
          lifeDomains: ['housing', 'credit'],
          textPosture: 'protective',
          disputed: true,
          summary: 'Enforcement stayed weak until the 1988 amendments.',
          description: 'Title VIII barred discrimination in the sale and rental of housing.',
        }}
      />
    </ul>,
  );
  assert.match(html, /href="\/entity\/ent_law_fair_housing_act_1968"/);
  assert.match(html, /What it did<\/p><p>Title VIII barred discrimination/);
  assert.match(html, /What followed<\/p><p[^>]*>Enforcement stayed weak/);
  assert.match(html, /Scholars disagree/);
  // The reader has no lens control, so it never prints the appendix's "Applied to" line.
  assert.doesNotMatch(html, /Applied to:/);
});

test('a rule card built from an older snapshot renders without a description or impact', async () => {
  const { LivesRuleCard } = await import('./LivesRuleCard');
  const html = renderToStaticMarkup(
    <ul>
      <LivesRuleCard
        rule={{
          id: 'shelley-us',
          entityId: 'ent_case_shelley_v_kraemer_1948',
          name: 'Shelley v. Kraemer',
          href: null,
          scopeLevel: 'federal',
          jurisdictionLabel: 'Federal',
          inForceFromYear: 1948,
          inForceToYear: null,
          appliesTo: ['black'],
          groupsNamed: [],
          lifeDomains: ['housing'],
          textPosture: 'protective',
          disputed: false,
          summary: null,
        }}
      />
    </ul>,
  );
  assert.match(html, /Shelley v\. Kraemer/);
  assert.doesNotMatch(html, /What it did|What followed/);
});

test('the reader and the appendix describe rules with one shared card', () => {
  const reader = readFileSync(path.join(here, 'LivesMilestoneExperience.tsx'), 'utf8');
  const appendix = readFileSync(path.join(here, 'LivesRulesInForce.tsx'), 'utf8');
  assert.match(reader, /<LivesRuleCard /);
  assert.match(appendix, /<LivesRuleCard /);
});

test('every group’s comparison bar is drawn at the same weight', () => {
  const css = readFileSync(path.join(here, '../../app/lives/lives.css'), 'utf8');
  // No per-group override may thin or fade one group's bar against another's.
  assert.doesNotMatch(css, /\[data-lens=['"][a-z]+['"]\]\s+\.lives-era__bar/);
  const bar = css.slice(css.indexOf('.lives-era__bar {'));
  const block = bar.slice(0, bar.indexOf('}'));
  assert.doesNotMatch(block, /opacity/);
});

test('an account plays from the archive, and is complete without the audio', async () => {
  const { LivesAccount } = await import('./LivesAccount');
  const html = renderToStaticMarkup(
    <LivesAccount
      beat={{
        id: '1880-housing-fountain-hughes',
        domain: 'housing',
        claimType: 'testimony',
        heading: 'After freedom, no home to go to',
        body: 'Fountain Hughes was recorded in Baltimore at 101.',
        citations: [
          { label: 'Library of Congress', url: 'https://www.loc.gov/item/afc1950037_afs09990a/' },
        ],
        appliesTo: ['black'],
        unit: 'all',
        entities: [],
        speaker: {
          name: 'Fountain Hughes',
          place: 'Baltimore, Maryland',
          year: '1949',
          mediation: 'recorded-interview',
          mediatedBy: 'Hermond Norwood',
        },
        quote: 'We didn’t have no property. We didn’t have no home.',
        recording: {
          mediaUrl: 'https://tile.loc.gov/storage-services/service/afc/x.mp3',
          itemUrl: 'https://www.loc.gov/item/afc1950037_afs09990a/',
          transcriptUrl: 'https://tile.loc.gov/storage-services/service/afc/x.pdf',
          holdingInstitution: 'the Library of Congress',
          creditLine: 'Cyrus B. Koonce Collection (AFC 1950/037), American Folklife Center',
          rightsNote: 'The Library is unaware of any copyright or other restrictions.',
          recordedOn: 'June 11, 1949, Baltimore, Maryland',
        },
      }}
    />,
  );
  // No request reaches the archive until the reader presses play, and nothing autoplays.
  assert.match(html, /<audio[^>]*preload="none"/);
  assert.doesNotMatch(html, /autoplay/i);
  assert.match(html, /src="https:\/\/tile\.loc\.gov\//);
  // The words, who took them down, the transcript and the archive link stand without the audio.
  assert.match(html, /We didn’t have no property/);
  assert.match(html, /Recorded interview with Hermond Norwood/);
  assert.match(html, /Read the transcript/);
  assert.match(html, /Listen at the Library of Congress/);
  assert.match(html, /unaware of any copyright/);
});

test('a beat without the speaker’s own words is not rendered as an account', async () => {
  const { LivesAccount } = await import('./LivesAccount');
  const html = renderToStaticMarkup(
    <LivesAccount
      beat={{
        id: 'x',
        domain: 'housing',
        claimType: 'factual',
        heading: 'h',
        body: 'b',
        citations: [],
        appliesTo: ['all'],
        unit: 'all',
        entities: [],
      }}
    />,
  );
  assert.equal(html, '');
});

test('every Lives text size comes from the design system type scale', () => {
  const css = readFileSync(path.join(here, '../../app/lives/lives.css'), 'utf8');
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1]!.trim());
  assert.ok(sizes.length > 50);
  const offScale = sizes.filter((size) => !/^var\(--ds-text-[a-z0-9-]+\)$/.test(size));
  // A one-off rem or clamp() value is how this page reached thirty different text sizes.
  assert.deepEqual(offScale, []);
});

test('an era with prose but no figure renders person first, says why there is no figure, and numbers its sources', async () => {
  const { LivesMilestoneExperience } = await import('./LivesMilestoneExperience');
  const { LIVES_MILESTONES } = await import('../../lib/lives/lives-milestones');
  const narrative = {
    doc: {
      slug: 'keeping-a-home-1870s-1890s',
      title: 'Forty acres promised, and taken back',
      placeLabel: 'Georgia and South Carolina',
      eraLabel: '1870s–1890s',
      series: { id: 'lives-home', label: 'Keeping a home', position: 1 },
      body: [],
    },
    blocks: [
      {
        type: 'paragraph',
        text: 'A family on the Sea Islands planted a second season.[ref:nara-field-order]',
      },
    ],
    references: [
      {
        number: 7,
        key: 'nara-field-order',
        label: 'National Archives',
        url: 'https://www.archives.gov/',
      },
    ],
    refNumberById: new Map([['nara-field-order', 7]]),
  };
  const bundle = {
    areaId: 'nation:US',
    areaSlug: 'united-states',
    areaName: 'United States',
    areaKind: 'nation',
    disclaimer: 'Comparison is not causation.',
    decades: [
      {
        decade: 1870,
        label: '1870s',
        conditions: [
          {
            key: 'homeownership',
            label: 'Owning their home',
            universe: 'Occupied homes',
            cells: {
              black: {
                state: 'not_measured',
                reason: 'The census didn’t publish this by race in the 1870s.',
              },
              white: { state: 'not_measured', reason: 'x' },
              hispanic: { state: 'not_measured', reason: 'x' },
            },
          },
        ],
        countNotes: [],
        rulesInForce: [],
        worldBeats: [
          {
            id: '1870-housing-fountain-hughes',
            domain: 'housing',
            claimType: 'testimony',
            heading: 'After freedom, no home to go to',
            body: 'Fountain Hughes was recorded in Baltimore in 1949.',
            citations: [],
            appliesTo: ['black'],
            unit: 'all',
            entities: [],
            speaker: {
              name: 'Fountain Hughes',
              place: 'Baltimore, Maryland',
              year: '1949',
              mediation: 'recorded-interview',
              mediatedBy: 'Hermond Norwood',
            },
            quote: 'We had nowhere or nothing.',
          },
        ],
      },
    ],
  };
  const html = renderToStaticMarkup(
    <LivesMilestoneExperience
      milestone={LIVES_MILESTONES[0]!}
      bundle={bundle as never}
      narratives={new Map([['1870-1890', narrative as never]])}
    />,
  );
  // The narrative's own title heads the panel; no era name comes from the product.
  assert.match(html, /<h3[^>]*>Forty acres promised, and taken back<\/h3>/);
  // A person first, then the history, then the honest line about the missing figure.
  const account = html.indexOf('We had nowhere or nothing');
  const prose = html.indexOf('planted a second season');
  const absence = html.indexOf('No comparison for this stretch');
  assert.ok(account > -1 && prose > account && absence > prose, 'order is account, prose, absence');
  assert.match(html, /The census didn’t publish this by race in the 1870s\./);
  assert.doesNotMatch(html, /class="lives-era__comparison"/);
  // The citation keeps the page-wide number it was given, so anchors never collide.
  assert.match(html, /href="#ref-7"/);
  assert.match(html, /id="ref-7"/);
  assert.match(html, /Sources for this stretch \(1\)/);
});

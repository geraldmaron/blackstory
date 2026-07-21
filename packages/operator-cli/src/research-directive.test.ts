/**
 * Tests for the shared research-directive loop and sundown-town county preset.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTargetedBriefHandlers,
  filterSundownGeojsonFeatures,
  parseSundownTownPageText,
  runResearchDirective,
  runSundownTownCountyBrief,
} from './research-directive.ts';
import { wrapPrefetchedSourceSnippet } from './research-source-gather.ts';

const GEOJSON = [
  {
    properties: {
      name: 'Anna',
      state: 'Illinois',
      confirmed: 9,
      permalink: 'https://justice.tougaloo.edu/sundowntown/anna-il/',
    },
  },
  {
    properties: {
      name: 'Goshen',
      state: 'Indiana',
      confirmed: 8,
      permalink: 'https://justice.tougaloo.edu/sundowntown/goshen-in/',
    },
  },
  {
    properties: {
      name: 'Pekin',
      state: 'Illinois',
      confirmed: 9,
      permalink: '/sundowntown/pekin-il/',
    },
  },
];

test('filterSundownGeojsonFeatures scopes by state and optional county substring', () => {
  const illinois = filterSundownGeojsonFeatures(GEOJSON, { state: 'Illinois' });
  assert.equal(illinois.length, 2);
  assert.ok(illinois.every((entry) => entry.state === 'Illinois'));

  const pekinOnly = filterSundownGeojsonFeatures(GEOJSON, { state: 'Illinois', county: 'Pekin' });
  assert.equal(pekinOnly.length, 1);
  assert.equal(pekinOnly[0]?.name, 'Pekin');
  assert.match(pekinOnly[0]!.primaryUrl, /^https:\/\/justice\.tougaloo\.edu\//u);
});

test('parseSundownTownPageText preserves Tougaloo confidence vocabulary', () => {
  const parsed = parseSundownTownPageText(
    'Basic Information Sundown Town in the Past? Surely Method of Exclusion signs posted at city limits.',
  );
  assert.equal(parsed.confidenceLabel, 'Surely');
  assert.match(parsed.summary, /Method of Exclusion/iu);
});

test('runResearchDirective runs plan→gather→extract→decide with prefetched gather override', async () => {
  const handlers = createTargetedBriefHandlers();
  const subject = {
    briefId: 'demo-brief',
    title: 'Demo brief',
    placeLabel: 'Illinois',
    seedUrls: ['https://archive.example.org/sundown/demo'],
  };
  const prefetched = wrapPrefetchedSourceSnippet(
    subject.seedUrls[0]!,
    'Anna Illinois sundown town documentation with checkable newspaper references, census context, and archived oral histories collected by local historians for review.',
  );
  assert.ok(prefetched);

  const result = await runResearchDirective(subject, {
    ...handlers,
    gather: async () => ({
      sources: [prefetched!],
      formattedSnippets: [`Source: ${prefetched!.url}\n${prefetched!.excerpt}`],
      attemptedUrlCount: 1,
      fetchedUrlCount: 0,
    }),
  });

  assert.equal(result.kind, 'research.directive.run.v1');
  assert.equal(result.plan.kind, 'targeted_brief');
  assert.equal(result.extracted.snippetCount, 1);
  assert.equal(result.decision.action, 'stage_for_review');
});

test('runSundownTownCountyBrief holds when no seed pages are reachable', async () => {
  const result = await runSundownTownCountyBrief(
    { state: 'Illinois', county: 'Anna', limit: 1 },
    GEOJSON,
    {
      dependencies: {
        resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
        transport: async () => {
          throw new Error('network blocked in test');
        },
      },
    },
  );
  assert.equal(result.plan.label, 'sundown-towns-Illinois-Anna');
  assert.equal(result.decision.action, 'hold');
  assert.equal(result.extracted.candidates.length, 1);
});

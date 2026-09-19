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

/**
 * Methodology v9 page wiring: room kit chrome, live evidence components, no drifted duplicate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_GRADE_DEFINITIONS,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PUBLISH_RULES,
} from './methodology-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'methodology-copy.ts'), 'utf8');
test('methodology page renders through the room kit, with no edition chrome left', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(pageSource, /METHODOLOGY_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(pageSource, /data-methodology-edition="v6"/);
  assert.match(pageSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(pageSource, /<Room>/);
});

test('methodology renders its header through the shared RoomHeader with the Receipt kicker', () => {
  assert.match(sectionsSource, /<RoomHeader/);
  assert.match(sectionsSource, /kicker="Receipt"/);
});

test('methodology renders grade marks and citation strings through the live record-page components', () => {
  // Same import source as apps/web/src/components/evidence/EvidenceCard.tsx, which is what
  // record pages render a claim's grade mark and citation string with.
  assert.match(sectionsSource, /import \{ Citation, Confidence, Notice \} from '@repo\/ui'/);
  assert.match(sectionsSource, /<Confidence/);
  assert.match(sectionsSource, /<Citation/);
  // No local reimplementation of the grade mark or the citation string.
  assert.doesNotMatch(sectionsSource, /ConfidenceMark/);
  assert.match(sectionsSource, /formatCitation/);
});

test('methodology section names match the record page vocabulary', () => {
  assert.match(sectionsSource, /How a record gets in/);
  assert.match(sectionsSource, /What the evidence grades mean/);
  assert.match(sectionsSource, /Why a point is never drawn sharper than its source/);
  assert.match(sectionsSource, /Living person protection/);
  assert.match(sectionsSource, /See it applied/);
});

test('methodology links to /memorial by name', () => {
  assert.match(sectionsSource, /href="\/memorial"/);
});

test('methodology stays on the server and does not sell the Atlas as a room', () => {
  assert.doesNotMatch(sectionsSource, /'use client'/);
  assert.doesNotMatch(sectionsSource, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(sectionsSource, /ResearchPipelineSketch|home-server/);
  assert.doesNotMatch(sectionsSource, /<Precision|confidenceNote|counterClaims|FACT_CONFIDENCE_DEFINITIONS/);
  assert.doesNotMatch(copySource, /confidenceNote|counterClaims|home-server/i);
  assert.match(copySource, /EVIDENCE_GRADE_DEFINITIONS/);
  assert.doesNotMatch(EVIDENCE_GRADE_DEFINITIONS.contested, /confidenceNote|counterClaims|`/);
});

test('methodology preserves core trust copy', () => {
  for (const beat of METHODOLOGY_MISSION_BEATS) {
    assert.match(copySource, new RegExp(beat.kicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const rule of METHODOLOGY_PUBLISH_RULES) {
    assert.match(copySource, new RegExp(rule.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('methodology does not fetch the live catalog', () => {
  assert.doesNotMatch(pageSource, /getPublicSearchIndex/);
  assert.match(pageSource, /export const revalidate = 3600/);
});

test('methodology user-facing copy avoids em dashes', () => {
  const strings = [
    METHODOLOGY_INTRO_LEDE,
    METHODOLOGY_DIGNITY_LINE,
    ...METHODOLOGY_MISSION_BEATS.flatMap((beat) => [beat.kicker, beat.body]),
    ...METHODOLOGY_PUBLISH_RULES.flatMap((rule) => [rule.title, rule.body]),
    ...Object.values(EVIDENCE_GRADE_DEFINITIONS),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
});

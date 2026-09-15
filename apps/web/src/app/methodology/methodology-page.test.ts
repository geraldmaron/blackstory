/**
 * Methodology wiring: body lives in MethodologySections; `/methodology` redirects into apparatus.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EDITORIAL_STANDARDS,
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

test('methodology page redirects into the apparatus room', () => {
  assert.match(pageSource, /permanentRedirect\('\/apparatus\?s=methodology'\)/);
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic|METHODOLOGY_EDITION_MOSAIC_SEED/);
});

test('methodology body uses ReadingEntry without a kicker when rendered alone', () => {
  assert.match(sectionsSource, /<ReadingEntry/);
  assert.doesNotMatch(sectionsSource, /<RoomHeader/);
  assert.doesNotMatch(sectionsSource, /kicker=/);
});

test('methodology renders grade marks and citation strings through the live record-page components', () => {
  assert.match(sectionsSource, /import \{ Citation, Confidence, Notice \} from '@repo\/ui'/);
  assert.match(sectionsSource, /<Confidence/);
  assert.match(sectionsSource, /<Citation/);
  assert.doesNotMatch(sectionsSource, /ConfidenceMark/);
  assert.match(sectionsSource, /formatCitation/);
});

test('methodology section names match the record page vocabulary', () => {
  assert.match(sectionsSource, /How a record gets in/);
  assert.match(sectionsSource, /What the evidence grades mean/);
  assert.match(sectionsSource, /Editorial standards/);
});

test('methodology copy still carries dignity and publish rules', () => {
  assert.ok(METHODOLOGY_DIGNITY_LINE.length > 0);
  assert.ok(METHODOLOGY_INTRO_LEDE.length > 0);
  assert.ok(METHODOLOGY_MISSION_BEATS.length > 0);
  assert.ok(METHODOLOGY_PUBLISH_RULES.length > 0);
  assert.ok(EDITORIAL_STANDARDS.length > 0);
  assert.ok(Object.keys(EVIDENCE_GRADE_DEFINITIONS).length > 0);
  assert.match(copySource, /METHODOLOGY_DIGNITY_LINE/);
});

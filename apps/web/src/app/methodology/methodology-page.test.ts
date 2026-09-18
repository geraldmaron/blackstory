/**
 * Methodology wiring: body lives in MethodologySections on `/methodology`.
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
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  METHODOLOGY_SOURCE_LIBRARY_HREF,
  SOURCE_LIBRARY_LEDE,
  SOURCE_LINEAGE_STAGES,
  SOURCE_PUBLISHER_KINDS,
} from './methodology-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'methodology-copy.ts'), 'utf8');

test('methodology page renders its own room, not a hub redirect', () => {
  assert.match(pageSource, /MethodologySections/);
  assert.doesNotMatch(pageSource, /permanentRedirect|how-it-works/);
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

test('methodology table of contents and chapters carry orientation glyphs', () => {
  for (const section of METHODOLOGY_PAGE_SECTIONS) {
    assert.ok(section.icon, `${section.label} carries a section glyph`);
  }
  assert.match(sectionsSource, /RoomJump/);
  assert.match(sectionsSource, /RoomSection/);
  assert.match(sectionsSource, /icon="source"/);
  assert.match(sectionsSource, /Open the source library/);
});

test('methodology hands the source library off to its own room', () => {
  const section = METHODOLOGY_PAGE_SECTIONS.find(
    (entry) => entry.id === 'where-the-evidence-comes-from',
  );
  assert.ok(section);
  assert.equal(section!.label, 'Where the evidence comes from');
  assert.equal(METHODOLOGY_SOURCE_LIBRARY_HREF, '/sources');
  assert.match(sectionsSource, /id="where-the-evidence-comes-from"/);
  assert.match(sectionsSource, /href="\/sources"/);
  assert.doesNotMatch(sectionsSource, /SOURCE_PUBLISHER_KINDS\.map/);
  assert.doesNotMatch(sectionsSource, /SOURCE_LIBRARY_SURFACES\.map/);
});

test('source-library copy names lineage and publisher kinds without fabricated counts', () => {
  assert.ok(SOURCE_LIBRARY_LEDE.length > 0);
  assert.equal(SOURCE_LINEAGE_STAGES.length, 4);
  assert.ok(SOURCE_PUBLISHER_KINDS.length >= 4);
  for (const value of [
    SOURCE_LIBRARY_LEDE,
    ...SOURCE_LINEAGE_STAGES.flatMap((stage) => [stage.title, stage.body]),
    ...SOURCE_PUBLISHER_KINDS.flatMap((entry) => [entry.kind, entry.body, entry.examples]),
  ]) {
    assert.doesNotMatch(value, /—/);
    assert.doesNotMatch(value, /\b\d{2,}\b publishers|\b\d{2,}\b claims/i);
  }
});

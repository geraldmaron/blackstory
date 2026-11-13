/**
 * Methodology wiring: the one page that defines the evidence grades, with processes drawn as
 * figures rather than restated in prose, and every section the rest of the site links to.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ADMISSION_STEPS,
  EDITORIAL_STANDARDS,
  GRADE_RULE_NOTES,
  METHODOLOGY_DIGNITY_LINE,
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_PAGE_SECTIONS,
  METHODOLOGY_PUBLISH_RULES,
  METHODOLOGY_SOURCE_LIBRARY_HREF,
  RECORD_GRADE_DEFINITIONS,
  SOURCE_LIBRARY_LEAD,
  SOURCE_LINEAGE_STAGES,
  SOURCE_PUBLISHER_KINDS,
} from './methodology-copy';
import { GradeMatrix, PrecisionLadder, gradeFor } from './MethodologyFigures';

void React;

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'MethodologySections.tsx'), 'utf8');

test('methodology renders its own room, not a hub redirect', () => {
  assert.match(pageSource, /MethodologySections/);
  assert.doesNotMatch(pageSource, /permanentRedirect|how-it-works/);
});

test('methodology opens on the shared PageHeader, with no kicker and no copper accent word', () => {
  const header = pageSource.match(/<PageHeader\b[\s\S]*?\/>/)?.[0] ?? '';
  assert.ok(header, 'methodology renders PageHeader');
  assert.doesNotMatch(header, /kicker=|<em>/);
});

test('the citation example is built by the real formatter, with the letter grade it prints', () => {
  assert.match(sectionsSource, /<Citation/);
  assert.match(sectionsSource, /formatCitation/);
  assert.match(sectionsSource, /grade: 'A'/);
});

test('the grade key states each letter once, plus Not graded, and never a fourth letter', () => {
  assert.deepEqual(
    RECORD_GRADE_DEFINITIONS.map((entry) => entry.grade),
    ['A', 'B', 'C', 'Not graded'],
  );
  assert.ok(GRADE_RULE_NOTES.some((note) => /Wikipedia/.test(note)));
  assert.match(sectionsSource, /<GradeKey/);
  assert.match(sectionsSource, /<GradeMatrix/);
});

test('the grade matrix is computed from the published rule, so it cannot drift from it', () => {
  assert.equal(gradeFor('high', 2), 'A');
  assert.equal(gradeFor('high', 1), 'B');
  assert.equal(gradeFor('medium', 2), 'B');
  assert.equal(gradeFor('medium', 1), 'C');
  assert.equal(gradeFor('low', 2), 'C');
  const html = renderToStaticMarkup(<GradeMatrix />);
  assert.match(html, /<table/);
  assert.match(html, /scope="col"/);
  assert.match(html, /Not graded/);
});

test("the precision ladder draws the map's own mark for each row, never a dot for an area", () => {
  const html = renderToStaticMarkup(<PrecisionLadder />);
  assert.deepEqual(
    [...html.matchAll(/data-mark="(\w+)"/g)].map((match) => match[1]),
    ['ring', 'dot'],
  );
  assert.match(html, /City, neighborhood or campus/);
  assert.match(html, /A hollow ring, never a dot/);
});

test('processes are figures, and the old sketch diagrams are gone', () => {
  assert.equal(ADMISSION_STEPS.length, 4);
  assert.match(sectionsSource, /<TrustFlow[\s\S]*?steps=\{ADMISSION_STEPS\}/);
  assert.match(sectionsSource, /<PrecisionLadder/);
  assert.doesNotMatch(sectionsSource, /MethodologyDiagrams|Notice|padStart/);
});

test('methodology copy still carries dignity, publish rules and standards', () => {
  assert.ok(METHODOLOGY_DIGNITY_LINE.length > 0);
  assert.ok(METHODOLOGY_INTRO_LEDE.length > 0);
  assert.ok(METHODOLOGY_PUBLISH_RULES.length >= 4);
  assert.ok(EDITORIAL_STANDARDS.length > 0);
});

test('methodology contents list names every section the page renders', () => {
  for (const section of METHODOLOGY_PAGE_SECTIONS) {
    assert.match(
      sectionsSource,
      new RegExp(`id="${section.id}"`),
      `${section.label} is on the page`,
    );
  }
  assert.match(sectionsSource, /RoomJump/);
  assert.match(sectionsSource, /Open the source library/);
});

test('methodology hands the source library off to its own room', () => {
  assert.equal(METHODOLOGY_SOURCE_LIBRARY_HREF, '/sources');
  assert.match(sectionsSource, /href: METHODOLOGY_SOURCE_LIBRARY_HREF/);
  assert.doesNotMatch(sectionsSource, /SOURCE_PUBLISHER_KINDS\.map/);
});

test('source-library copy names lineage and publisher kinds, with no em dashes', () => {
  assert.ok(SOURCE_LIBRARY_LEAD.length > 0);
  assert.equal(SOURCE_LINEAGE_STAGES.length, 4);
  assert.ok(SOURCE_PUBLISHER_KINDS.length >= 4);
  for (const value of [
    SOURCE_LIBRARY_LEAD,
    ...SOURCE_LINEAGE_STAGES.flatMap((stage) => [stage.title, stage.body]),
    ...SOURCE_PUBLISHER_KINDS.flatMap((entry) => [entry.kind, entry.body, entry.examples]),
  ]) {
    assert.doesNotMatch(value, /—/);
  }
});

/**
 * The Turn's limits, enforced. Each assertion is a rule from
 * docs/research/lives-structure-decision.md §5 or from the community review decision in
 * docs/methodology/lives-across-decades.md.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findProseVoiceIssues } from '@repo/domain/editorial';
import { LIVES_ERAS, LIVES_MILESTONE_KEYS } from './lives-milestones';
import { LIVES_TURNS, livesTurnFor } from './lives-turns';
import { LivesTurn } from '../../components/lives/LivesTurn';

void React;

const GROUP_WORDS =
  /\b(black|white|hispanic|latino|latina|negro|colored|african[- ]american|mexican|asian|native)\b/i;

test('there is exactly one Turn per column, and only form 3 ships', () => {
  assert.deepEqual(Object.keys(LIVES_TURNS).sort(), [...LIVES_MILESTONE_KEYS].sort());
  for (const turn of Object.values(LIVES_TURNS)) assert.equal(turn.form, 3);
});

test('no group appears in any question or any answer choice', () => {
  for (const [key, turn] of Object.entries(LIVES_TURNS)) {
    assert.doesNotMatch(turn.prompt, GROUP_WORDS, `${key}: the question names a group`);
    for (const option of turn.options) {
      assert.doesNotMatch(option.label, GROUP_WORDS, `${key}: an answer choice names a group`);
    }
  }
});

test('no Turn asks a reader to estimate a rate', () => {
  for (const [key, turn] of Object.entries(LIVES_TURNS)) {
    const asked = [turn.prompt, ...turn.options.map((option) => option.label)].join(' ');
    assert.doesNotMatch(asked, /%|\bpercent\b|\bin 100\b|\bhow many\b|\bwhat share\b/i, key);
  }
});

test('every Turn answers the classroom test in writing and points at a published record', () => {
  const eraIds = new Set(LIVES_ERAS.map((era) => era.id));
  for (const [key, turn] of Object.entries(LIVES_TURNS)) {
    assert.ok(turn.classroomTest.trim().length > 40, `${key}: classroom test not answered`);
    assert.ok(eraIds.has(turn.eraId), `${key}: ${turn.eraId} is not an era`);
    assert.equal(turn.options.length, 3);
    assert.ok(
      turn.options.some((option) => option.id === turn.answerId),
      `${key}: the answer is not one of the choices`,
    );
    assert.ok(
      turn.records.length + (turn.citations?.length ?? 0) > 0,
      `${key}: the reveal cites no published record`,
    );
    for (const record of turn.records) assert.match(record.href, /^\/entity\/ent_(law|case)_/);
    for (const source of turn.citations ?? []) assert.match(source.url, /^https:\/\//);
  }
});

test('questions and reveals answer to the same voice gate as the rest of Lives', () => {
  const failures = Object.entries(LIVES_TURNS).flatMap(([key, turn]) =>
    [turn.prompt, turn.reveal, ...turn.options.map((option) => option.label)].flatMap((text) =>
      findProseVoiceIssues(text).map((finding) => `${key}: ${finding.label}: …${finding.excerpt}…`),
    ),
  );
  assert.deepEqual(failures, []);
});

test('a Turn sits in one era panel only', () => {
  assert.equal(livesTurnFor('home', '1940-1960')?.answerId, '1968');
  assert.equal(livesTurnFor('home', '1900-1930'), null);
});

test('the control is a native radio group and shows nothing before a choice', () => {
  const html = renderToStaticMarkup(<LivesTurn turn={LIVES_TURNS.home} />);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.match(html, /<fieldset[^>]*>\s*<legend>/);
  assert.match(html, /aria-live="polite"/);
  // Unanswered, the record is not in the markup at all, so it cannot be read ahead.
  assert.doesNotMatch(html, /Fair Housing Act, enacted that April/);
});

test('the Turn never stores, sends, scores, or logs a reader’s answer', () => {
  // Code only: the component's own comments describe these rules in the words being banned.
  const source = readFileSync(
    new URL('../../components/lives/LivesTurn.tsx', import.meta.url),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|sendBeacon|XMLHttpRequest|console\.|analytics|track\(/,
  );
  assert.doesNotMatch(source, /score|streak|correct|wrong|tally/i);
  assert.doesNotMatch(source, /touch-action|onDrag|onPointerMove/);
});

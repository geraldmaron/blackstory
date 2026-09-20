/**
 * Lives narrative prose answers to docs/content/neo-voice.md, the same as a chapter. This is the
 * word-level gate: every authored string a reader sees in a reading, an account, or a beat is
 * held to the shared checks in @repo/domain/editorial. Quoted testimony is exempt there.
 *
 * Labels and chrome (kickers, source labels, rights lines) are governed by docs/ui/story.md and
 * are not checked here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findProseVoiceIssues } from '@repo/domain/editorial';
import { LIVES_ARCHIVE_READINGS } from './lives-archive';
import { LIVES_WORLD_BEAT_FIXTURES } from './world-beat-fixtures';
import { LIVES_TURNS } from './lives-turns';

type Authored = { readonly where: string; readonly text: string };

function archiveProse(): Authored[] {
  return Object.entries(LIVES_ARCHIVE_READINGS).flatMap(([key, reading]) => [
    { where: `${key}.title`, text: reading.title },
    { where: `${key}.caption`, text: reading.caption },
    ...reading.paragraphs.map((text, index) => ({ where: `${key}.paragraphs[${index}]`, text })),
    { where: `${key}.notice`, text: reading.notice },
    { where: `${key}.question`, text: reading.question },
    ...reading.connections.map((link, index) => ({
      where: `${key}.connections[${index}].line`,
      text: link.line,
    })),
    ...(reading.companion
      ? [
          { where: `${key}.companion.title`, text: reading.companion.title },
          { where: `${key}.companion.body`, text: reading.companion.body },
          { where: `${key}.companion.scope`, text: reading.companion.scope },
        ]
      : []),
  ]);
}

function beatProse(): Authored[] {
  return LIVES_WORLD_BEAT_FIXTURES.flatMap((beat) => [
    { where: `beat ${beat.id} heading`, text: beat.heading },
    { where: `beat ${beat.id} body`, text: beat.body },
  ]);
}

function turnProse(): Authored[] {
  return Object.entries(LIVES_TURNS).flatMap(([key, turn]) => [
    { where: `turn ${key} prompt`, text: turn.prompt },
    { where: `turn ${key} reveal`, text: turn.reveal },
    ...turn.options.map((option) => ({ where: `turn ${key} option`, text: option.label })),
  ]);
}

test('Lives readings, accounts and beats pass the word-level voice gate', () => {
  const failures = [...archiveProse(), ...beatProse(), ...turnProse()].flatMap(({ where, text }) =>
    findProseVoiceIssues(text).map((finding) => `${where}: ${finding.label}: …${finding.excerpt}…`),
  );
  assert.deepEqual(failures, []);
});

test('a person a reading is about is named in full before being named by surname', () => {
  const people = [{ full: 'W. E. B. Du Bois', short: 'Du Bois' }];
  for (const [key, reading] of Object.entries(LIVES_ARCHIVE_READINGS)) {
    const prose = reading.paragraphs.join(' ');
    for (const { full, short } of people) {
      const firstShort = prose.indexOf(short);
      if (firstShort === -1) continue;
      assert.equal(
        prose.indexOf(full),
        firstShort - (full.length - short.length),
        `${key}: "${short}" appears before the full name "${full}"`,
      );
    }
  }
});

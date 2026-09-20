/**
 * Subject-position floor for the Lives reader (repo-0clax.50.1, gate 2).
 *
 * A page built on gaps can narrate Black Americans only as people things were done to. This check
 * reads the reader's RENDERED output, not the authored strings, and requires each life question to
 * carry at least one sentence whose grammatical subject is a named Black person or institution
 * doing something: the verbs docs/content/neo-voice.md prefers (organized, sued, built, founded)
 * over the ones it warns against as the only verbs (endured, suffered).
 *
 * It is a floor, not an answer. A pattern can confirm that an acting subject exists; it cannot
 * judge whether the page gives agency its due. Prose review and ringer review own that.
 *
 * KNOWN_GAPS is shrink-only: a question listed there must still fail, so fixing the prose forces
 * the entry out, and nothing new may be added without a tracked issue.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LivesAreaBundle } from '@repo/domain/statistics/lives';
import { LIVES_MILESTONES, type LivesMilestoneKey } from '../../lib/lives/lives-milestones';
import { LivesMilestoneExperience } from './LivesMilestoneExperience';

void React;

/** Named Black people and institutions each question's reading narrates. */
const ACTORS: Readonly<Record<LivesMilestoneKey, readonly string[]>> = {
  home: ['W. E. B. Du Bois', 'Du Bois', 'Settlers from Kentucky'],
  place: ['W. E. B. Du Bois', 'Du Bois', 'Settlers from Kentucky'],
  school: ['Booker T. Washington', 'Washington', 'these students'],
  education: ['Oliver Brown', 'Thurgood Marshall', 'NAACP', 'the plaintiffs', 'parents'],
  work: ['A. Philip Randolph', 'Randolph', 'Booker T. Washington', 'Washington'],
  count: ['W. E. B. Du Bois', 'Du Bois'],
};

const AGENCY_VERBS =
  /\b(?:organized|sued|petitioned|testified|built|founded|established|chose|gave|gives|used|uses|arranged|began|taught|bought|purchased|filed|opened|settled|wrote|drew|made|studied|studying|gained|paid|raised|marched|threatened|registered|voted|enrolled|ran)\b/i;

/** Questions whose reading has no acting Black subject yet. Tracked in repo-0clax.50.11. */
const KNOWN_GAPS: readonly LivesMilestoneKey[] = ['education'];

function renderedSentences(key: LivesMilestoneKey): string[] {
  const milestone = LIVES_MILESTONES.find((entry) => entry.key === key)!;
  const html = renderToStaticMarkup(
    <LivesMilestoneExperience
      milestone={milestone}
      bundle={{ decades: [] } as unknown as LivesAreaBundle}
    />,
  );
  const start = html.indexOf('class="lives-archive"');
  const text = html
    .slice(start)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&apos;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  return text.split(/(?<=[.?!])\s+/);
}

function hasActingSubject(key: LivesMilestoneKey): boolean {
  return renderedSentences(key).some((sentence) =>
    ACTORS[key].some((actor) => {
      const at = sentence.indexOf(actor);
      // Subject position: early in the sentence, and not a possessive ("Randolph’s march").
      if (at === -1 || at > 60) return false;
      const after = sentence.slice(at + actor.length);
      if (/^(?:’s|'s)/.test(after)) return false;
      return AGENCY_VERBS.test(after.slice(0, 80));
    }),
  );
}

test('each life question renders at least one Black person or institution acting', () => {
  for (const { key } of LIVES_MILESTONES) {
    if (KNOWN_GAPS.includes(key)) continue;
    assert.ok(hasActingSubject(key), `${key}: no sentence has a named Black subject acting`);
  }
});

test('the known-gap list only shrinks', () => {
  for (const key of KNOWN_GAPS) {
    assert.equal(
      hasActingSubject(key),
      false,
      `${key} now has an acting subject: remove it from KNOWN_GAPS`,
    );
  }
});

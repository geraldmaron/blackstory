import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StoryContributorDoc } from '@repo/schemas';
import { storyBylineLines } from './byline';

const person = (name: string, roles: StoryContributorDoc['roles']): StoryContributorDoc => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  kind: 'person',
  roles,
});

test('no contributors reads as the implicit house author', () => {
  assert.deepEqual(storyBylineLines([]), ['By Neo']);
});

test('authors keep array order and join in plain English', () => {
  assert.deepEqual(storyBylineLines([person('A', ['author'])]), ['By A']);
  assert.deepEqual(storyBylineLines([person('A', ['author']), person('B', ['author'])]), [
    'By A and B',
  ]);
  assert.deepEqual(
    storyBylineLines([person('A', ['author']), person('B', ['author']), person('C', ['author'])]),
    ['By A, B and C'],
  );
});

test('researchers and editors get their own lines; one person can appear under several', () => {
  assert.deepEqual(
    storyBylineLines([
      person('Gerald Dagher', ['author', 'editor']),
      person('Neo', ['author']),
      person('R', ['researcher']),
    ]),
    ['By Gerald Dagher and Neo', 'Research by R', 'Edited by Gerald Dagher'],
  );
});

test('contributors with no author role fall back to the implicit author', () => {
  assert.deepEqual(storyBylineLines([person('E', ['editor'])]), ['By Neo', 'Edited by E']);
});

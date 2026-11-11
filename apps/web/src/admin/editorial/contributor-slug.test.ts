import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storyContributorSchema } from '@repo/schemas';
import { slugFromName } from './contributor-slug';

test('slugFromName yields ids the contributor schema accepts', () => {
  for (const [name, slug] of [
    ['Gerald Dagher', 'gerald-dagher'],
    ['  Zoë  O’Neil-Smith! ', 'zoe-o-neil-smith'],
    ['Neo', 'neo'],
  ] as const) {
    assert.equal(slugFromName(name), slug);
    assert.ok(
      storyContributorSchema.shape.id.safeParse(slug).success,
      `${slug} fails the schema regex`,
    );
  }
  assert.equal(slugFromName('***'), '');
  assert.ok(slugFromName('a'.repeat(150)).length <= 100);
});

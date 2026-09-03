/**
 * `placeDetail` is the rule for printing a place line directly beneath the record's own name.
 * It is deliberately narrow: it drops one exact, comma-terminated head and nothing else, because
 * the alternative — matching loosely — silently eats real address detail.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeDetail } from './place-label';

test('drops an address head that restates the name', () => {
  assert.equal(
    placeDetail(
      '100 Block North Greenwood Avenue',
      '100 Block North Greenwood Avenue, Tulsa, Oklahoma',
    ),
    'Tulsa, Oklahoma',
  );
});

test('matching ignores case but still requires the comma', () => {
  assert.equal(
    placeDetail('dunbar high school', 'Dunbar High School, Washington, DC'),
    'Washington, DC',
  );
  assert.equal(
    placeDetail('Greenwood', 'Greenwood Avenue, Tulsa, Oklahoma'),
    'Greenwood Avenue, Tulsa, Oklahoma',
  );
});

test('a place that is only its own name keeps the full line rather than rendering blank', () => {
  assert.equal(placeDetail('Tulsa, Oklahoma', 'Tulsa, Oklahoma'), 'Tulsa, Oklahoma');
  assert.equal(placeDetail('Mound Bayou,', 'Mound Bayou,'), 'Mound Bayou,');
});

test('an unrelated place line is returned untouched', () => {
  assert.equal(
    placeDetail('Harriet Tubman', 'Dorchester County, Maryland'),
    'Dorchester County, Maryland',
  );
  assert.equal(placeDetail('', 'Place withheld'), 'Place withheld');
});

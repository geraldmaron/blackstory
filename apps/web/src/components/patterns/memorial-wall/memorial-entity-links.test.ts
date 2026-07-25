/**
 * Tests for exact-match memorial-name-to-entity linking.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchMemorialNamesToEntities } from './memorial-entity-links';

test('matches exact display names case-insensitively and trims whitespace', () => {
  const entities = [
    { id: 'e1', displayName: 'Trayvon Martin' },
    { id: 'e2', displayName: '  George Floyd ' },
  ];
  const matches = matchMemorialNamesToEntities(
    ['Trayvon Martin', 'trayvon martin', 'George Floyd', 'Emmett Till'],
    entities,
  );
  assert.equal(matches.get('Trayvon Martin'), 'e1');
  assert.equal(matches.get('trayvon martin'), 'e1');
  assert.equal(matches.get('George Floyd'), 'e2');
  assert.equal(matches.has('Emmett Till'), false);
});

test('does not fuzzy match near-misses', () => {
  const entities = [{ id: 'e1', displayName: 'Trayvon Martin' }];
  const matches = matchMemorialNamesToEntities(['Trayvon Martinez', 'Trayvon  Martin'], entities);
  assert.equal(matches.has('Trayvon Martinez'), false);
  // internal whitespace is normalized, so double-space still matches
  assert.equal(matches.get('Trayvon  Martin'), 'e1');
});

test('empty entity list produces no matches', () => {
  const matches = matchMemorialNamesToEntities(['Trayvon Martin'], []);
  assert.equal(matches.size, 0);
});

test('first entity wins on duplicate display names', () => {
  const entities = [
    { id: 'first', displayName: 'Same Name' },
    { id: 'second', displayName: 'Same Name' },
  ];
  const matches = matchMemorialNamesToEntities(['Same Name'], entities);
  assert.equal(matches.get('Same Name'), 'first');
});

test('blank display names are never matchable', () => {
  const entities = [{ id: 'e1', displayName: '   ' }];
  const matches = matchMemorialNamesToEntities(['   '], entities);
  assert.equal(matches.size, 0);
});

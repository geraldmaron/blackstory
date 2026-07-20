import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asFactId,
  buildFactJsonPath,
  buildFactPath,
  buildFactRevisionPath,
  buildLegacyFactPath,
  formatFactId,
  isFactId,
  slugNeedsRedirect,
  slugifyFactStatement,
} from './ids.js';

test('formatFactId produces a zero-padded BB-F-###### id', () => {
  assert.equal(formatFactId(42), 'BB-F-000042');
  assert.equal(formatFactId(123456), 'BB-F-123456');
});

test('isFactId accepts the canonical format and rejects malformed ids', () => {
  assert.equal(isFactId('BB-F-000042'), true);
  assert.equal(isFactId('BB-F-42'), false);
  assert.equal(isFactId('ds-f-000042'), false);
  assert.equal(isFactId('BB-F-'), false);
});

test('asFactId throws on invalid input', () => {
  assert.throws(() => asFactId('not-a-fact-id'));
  assert.doesNotThrow(() => asFactId('BB-F-000001'));
});

test('formatFactId rejects non-positive-integer sequences', () => {
  assert.throws(() => formatFactId(0));
  assert.throws(() => formatFactId(-1));
  assert.throws(() => formatFactId(1.5));
});

test('slugifyFactStatement lowercases, strips punctuation, and hyphenates', () => {
  assert.equal(
    slugifyFactStatement('Rosa Parks refused to give up her seat, 1955.'),
    'rosa-parks-refused-to-give-up-her-seat-1955',
  );
});

test('slugifyFactStatement caps length at 80 characters', () => {
  const long = 'a'.repeat(200);
  const slug = slugifyFactStatement(long);
  assert.ok(slug.length <= 80);
});

test('slugifyFactStatement throws on input with no sluggable characters', () => {
  assert.throws(() => slugifyFactStatement('???'));
});

test('buildFactPath / buildFactRevisionPath / buildFactJsonPath produce canonical permalinks', () => {
  const id = asFactId('BB-F-000042');
  assert.equal(buildFactPath(id, 'rosa-parks-refused'), '/facts/rosa-parks-refused');
  assert.equal(
    buildLegacyFactPath(id, 'rosa-parks-refused'),
    '/facts/BB-F-000042/rosa-parks-refused',
  );
  assert.equal(buildFactRevisionPath(id, 3), '/facts/BB-F-000042/rev/3');
  assert.equal(buildFactJsonPath(id), '/facts/BB-F-000042.json');
});

test('buildFactRevisionPath rejects non-positive revision numbers', () => {
  const id = asFactId('BB-F-000042');
  assert.throws(() => buildFactRevisionPath(id, 0));
  assert.throws(() => buildFactRevisionPath(id, -1));
});

test('slugNeedsRedirect detects a stale slug and accepts a current one', () => {
  assert.equal(slugNeedsRedirect('old-slug', 'Rosa Parks refused to give up her seat'), true);
  assert.equal(
    slugNeedsRedirect(
      'rosa-parks-refused-to-give-up-her-seat',
      'Rosa Parks refused to give up her seat',
    ),
    false,
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { staleEditMessage } from './edit-state';

test('a save against the copy it loaded goes through', () => {
  assert.equal(staleEditMessage('2026-11-10T12:00:00.000Z', '2026-11-10T12:00:00.000Z'), null);
});

test('a save after someone else changed the record is refused', () => {
  assert.match(
    staleEditMessage('2026-11-10T12:00:00.000Z', '2026-11-10T12:05:00.000Z') ?? '',
    /changed after you opened it/,
  );
});

test('a form that sends no loaded time is not blocked', () => {
  assert.equal(staleEditMessage('', '2026-11-10T12:05:00.000Z'), null);
});

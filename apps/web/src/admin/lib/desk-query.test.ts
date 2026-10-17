import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSqlBinder,
  normalizeDeskPageSize,
  paginate,
  readIsoDay,
  readMany,
  toggleValue,
} from './desk-query';

test('readMany accepts repeated and comma-joined keys without duplicates', () => {
  assert.deepEqual(readMany({ a: ['x,y', 'y', ' z '] }, 'a'), ['x', 'y', 'z']);
  assert.deepEqual(readMany({}, 'a'), []);
});

test('readIsoDay rejects impossible and malformed days', () => {
  assert.equal(readIsoDay({ d: '2026-02-28' }, 'd'), '2026-02-28');
  assert.equal(readIsoDay({ d: '2026-02-30' }, 'd'), undefined);
  assert.equal(readIsoDay({ d: "2026-01-01'; DROP" }, 'd'), undefined);
});

test('paginate clamps a stale page and reports offsets', () => {
  assert.deepEqual(paginate(120, 9, 50), { page: 3, pageCount: 3, offset: 100 });
  assert.deepEqual(paginate(0, 4, 50), { page: 1, pageCount: 1, offset: 0 });
});

test('normalizeDeskPageSize bounds the page size', () => {
  assert.equal(normalizeDeskPageSize(undefined), 50);
  assert.equal(normalizeDeskPageSize(10_000), 200);
  assert.equal(normalizeDeskPageSize(0), 1);
});

test('toggleValue adds and removes', () => {
  assert.deepEqual(toggleValue(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleValue(['a', 'b'], 'a'), ['b']);
});

test('createSqlBinder numbers placeholders in order', () => {
  const { bind, params } = createSqlBinder();
  assert.equal(bind('x'), '$1');
  assert.equal(bind('y'), '$2');
  assert.deepEqual(params, ['x', 'y']);
});

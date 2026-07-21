/**
 * Unit tests for migration util helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  omitUndefined,
  toIsoTimestamp,
  toJsonValue,
} from './util.js';

describe('migration util', () => {
  it('coerces primitives', () => {
    assert.equal(asString(42), '42');
    assert.equal(asBoolean(true), true);
    assert.equal(asNumber('12'), 12);
    assert.deepEqual(asStringArray(['a', 1, 'b']), ['a', 'b']);
  });

  it('normalizes timestamps', () => {
    assert.equal(toIsoTimestamp('2026-07-16T18:00:00.000Z'), '2026-07-16T18:00:00.000Z');
    assert.equal(toIsoTimestamp({ seconds: 0 }), '1970-01-01T00:00:00.000Z');
  });

  it('omits undefined for exactOptionalPropertyTypes rows', () => {
    assert.deepEqual(omitUndefined({ a: 1, b: undefined }), { a: 1 });
  });

  it('makes jsonb-safe values from timestamp-like objects', () => {
    assert.equal(toJsonValue({ seconds: 0, nanoseconds: 0 }), '1970-01-01T00:00:00.000Z');
    assert.deepEqual(toJsonValue({ a: 1, b: undefined }), { a: 1 });
  });
});

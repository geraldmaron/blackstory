/**
 * EDTF Level 1 round-trip tests for owner-ratified lexical forms.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertEdtfLevel1,
  boundsToDaterangeLiteral,
  parseEdtfLevel1,
  TEMPORAL_CALENDAR_MODEL,
} from './edtf.js';

test('parseEdtfLevel1 round-trips circa 1850~', () => {
  const result = parseEdtfLevel1('1850~');
  assert.ok(result);
  assert.equal(result.edtf, '1850~');
  assert.equal(result.precision, 'circa');
  assert.equal(result.calendarModel, TEMPORAL_CALENDAR_MODEL);
  assert.equal(result.bounds.earliest, '1850-01-01');
  assert.equal(result.bounds.latest, '1850-12-31');
});

test('parseEdtfLevel1 round-trips decade 188X', () => {
  const result = parseEdtfLevel1('188X');
  assert.ok(result);
  assert.equal(result.edtf, '188X');
  assert.equal(result.precision, 'decade');
  assert.equal(result.bounds.earliest, '1880-01-01');
  assert.equal(result.bounds.latest, '1889-12-31');
});

test('parseEdtfLevel1 round-trips open interval [..1865]', () => {
  const result = parseEdtfLevel1('[..1865]');
  assert.ok(result);
  assert.equal(result.edtf, '[..1865]');
  assert.equal(result.bounds.latest, '1865-12-31');
  assert.equal(result.bounds.earliest, '0001-01-01');
});

test('parseEdtfLevel1 round-trips exact day 1920-06-15', () => {
  const result = assertEdtfLevel1('1920-06-15');
  assert.equal(result.edtf, '1920-06-15');
  assert.equal(result.precision, 'day');
  assert.equal(result.bounds.earliest, '1920-06-15');
  assert.equal(result.bounds.latest, '1920-06-15');
});

test('parseEdtfLevel1 rejects empty and season strings', () => {
  assert.equal(parseEdtfLevel1(''), null);
  assert.equal(parseEdtfLevel1('2016-21'), null);
});

test('boundsToDaterangeLiteral builds inclusive Postgres range', () => {
  const literal = boundsToDaterangeLiteral({
    earliest: '1920-06-15',
    latest: '1920-06-15',
  });
  assert.equal(literal, '[1920-06-15,1920-06-15]');
});

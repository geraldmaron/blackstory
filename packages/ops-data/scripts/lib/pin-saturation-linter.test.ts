/**
 * Regression tests for the pin-saturation linter (repo-x8j6). The defect it exists to catch:
 * people pinned at the institution that honors or buried them rather than anywhere they lived.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALLOWED_SHARED_PINS,
  lintPinSaturation,
  pinSaturationFailureMessage,
} from './pin-saturation-linter.ts';

const COOPERSTOWN = { lat: 42.6999, lng: -74.9233 };
const EMANUEL_AME = { lat: 32.7875, lng: -79.93305556 };

function person(entityId: string, coords: { lat: number; lng: number }, precision = 'site') {
  return { entityId, kind: 'person', lat: coords.lat, lng: coords.lng, precision };
}

test('flags many people stacked on one exact coordinate as an error', () => {
  const report = lintPinSaturation([
    person('a', COOPERSTOWN),
    person('b', COOPERSTOWN),
    person('c', COOPERSTOWN),
    person('d', COOPERSTOWN),
  ]);
  assert.equal(report.hasErrors, true);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].code, 'people_stacked_on_exact_pin');
  assert.equal(report.findings[0].severity, 'error');
  assert.deepEqual(report.findings[0].entityIds, ['a', 'b', 'c', 'd']);
});

test('a pair on one pin warns rather than errors — two siblings is not a batch defect', () => {
  const report = lintPinSaturation([person('a', COOPERSTOWN), person('b', COOPERSTOWN)]);
  assert.equal(report.hasErrors, false);
  assert.equal(report.findings.length, 0);
});

test('three on one pin warns without failing the build', () => {
  const report = lintPinSaturation([
    person('a', COOPERSTOWN),
    person('b', COOPERSTOWN),
    person('c', COOPERSTOWN),
  ]);
  assert.equal(report.hasErrors, false);
  assert.equal(report.findings[0].severity, 'warn');
});

test('coarse precisions are never flagged — a county pin already reads as approximate', () => {
  const report = lintPinSaturation([
    person('a', COOPERSTOWN, 'county'),
    person('b', COOPERSTOWN, 'county'),
    person('c', COOPERSTOWN, 'county'),
    person('d', COOPERSTOWN, 'city'),
    person('e', COOPERSTOWN, 'city'),
    person('f', COOPERSTOWN, 'city'),
  ]);
  assert.deepEqual(report.findings, []);
});

test('places sharing a coordinate are not the defect — only people are', () => {
  const report = lintPinSaturation([
    { entityId: 'p1', kind: 'place', ...COOPERSTOWN, precision: 'site' },
    { entityId: 'p2', kind: 'place', ...COOPERSTOWN, precision: 'site' },
    { entityId: 'p3', kind: 'place', ...COOPERSTOWN, precision: 'site' },
    { entityId: 'p4', kind: 'place', ...COOPERSTOWN, precision: 'site' },
  ]);
  assert.deepEqual(report.findings, []);
});

test('genuine co-location is exempt: the Emanuel Nine were killed at that address', () => {
  const report = lintPinSaturation([
    person('v1', EMANUEL_AME, 'institution'),
    person('v2', EMANUEL_AME, 'institution'),
    person('v3', EMANUEL_AME, 'institution'),
    person('v4', EMANUEL_AME, 'institution'),
    person('v5', EMANUEL_AME, 'institution'),
  ]);
  assert.deepEqual(report.findings, []);
});

test('every allowed shared pin carries a reason, so exemptions stay reviewed decisions', () => {
  assert.ok(ALLOWED_SHARED_PINS.length > 0);
  for (const allowed of ALLOWED_SHARED_PINS) {
    assert.ok(allowed.reason.trim().length > 20, `${allowed.lat},${allowed.lng} needs a reason`);
  }
});

test('records without coordinates are skipped rather than bucketed together', () => {
  const report = lintPinSaturation([
    { entityId: 'a', kind: 'person', lat: null, lng: null, precision: 'site' },
    { entityId: 'b', kind: 'person', lat: null, lng: null, precision: 'site' },
    { entityId: 'c', kind: 'person', lat: null, lng: null, precision: 'site' },
    { entityId: 'd', kind: 'person', lat: null, lng: null, precision: 'site' },
  ]);
  assert.deepEqual(report.findings, []);
});

test('failure message names the coordinate and the people on it', () => {
  const report = lintPinSaturation([
    person('a', COOPERSTOWN),
    person('b', COOPERSTOWN),
    person('c', COOPERSTOWN),
    person('d', COOPERSTOWN),
  ]);
  const message = pinSaturationFailureMessage(report);
  assert.match(message, /Pin saturation lint failed/);
  assert.match(message, /42\.6999/);
  assert.match(message, /4 people/);
});

test('a clean catalog passes', () => {
  const report = lintPinSaturation([
    person('a', { lat: 29.8322, lng: -84.6644 }),
    person('b', { lat: 29.6486, lng: -81.6376 }),
  ]);
  assert.equal(report.hasErrors, false);
  assert.equal(pinSaturationFailureMessage(report), 'Pin saturation lint passed.');
});

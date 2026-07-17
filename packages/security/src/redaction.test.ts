
/**
 * Tests for precision reduction, location redaction, and the deep value scrubber.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSensitiveDataRedactor,
  reducePublicPrecision,
  redactLocationForPublic,
  redactSensitiveValues,
} from './index.ts';

test('unknown living status behaves as living for precision reduction', () => {
  const unknown = reducePublicPrecision({ precision: 'street_address', livingStatus: 'unknown' });
  const living = reducePublicPrecision({ precision: 'street_address', livingStatus: 'living' });
  assert.equal(unknown.reduced, true);
  assert.equal(unknown.reason, 'living_residential_precision_prohibited');
  assert.equal(unknown.precision, 'city');
  assert.deepEqual(
    { reduced: unknown.reduced, reason: unknown.reason, precision: unknown.precision },
    { reduced: living.reduced, reason: living.reason, precision: living.precision },
  );
});

test('omitted living status defaults to living (treat-as-living)', () => {
  const result = reducePublicPrecision({ precision: 'residence' });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'living_residential_precision_prohibited');
});

test('deceased historical residence reduces to neighborhood', () => {
  const result = reducePublicPrecision({ precision: 'street_address', livingStatus: 'deceased' });
  assert.equal(result.reduced, true);
  assert.equal(result.precision, 'neighborhood');
  assert.equal(result.reason, 'prohibited_location_precision');
});

test('occupied private residence of a deceased person is reduced', () => {
  const result = reducePublicPrecision({
    precision: 'street_address',
    livingStatus: 'deceased',
    occupiedPrivateResidence: true,
  });
  assert.equal(result.reduced, true);
  assert.equal(result.precision, 'neighborhood');
  assert.equal(result.reason, 'occupied_private_residence_reduced');
});

test('allowed coarse precision is not reduced', () => {
  const result = reducePublicPrecision({ precision: 'city', livingStatus: 'living' });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'city');
});

test('exact coordinates are trimmed when not needed', () => {
  const result = reducePublicPrecision({
    precision: 'exact_coordinates',
    livingStatus: 'deceased',
  });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'exact_coordinates_reduced');
});

test('unknown precision levels fail closed to none', () => {
  const result = reducePublicPrecision({ precision: 'satellite_pinpoint' });
  assert.equal(result.reduced, true);
  assert.equal(result.precision, 'none');
  assert.equal(result.reason, 'unknown_precision_level');
});

test('every reduction records the policy version', () => {
  const result = reducePublicPrecision({ precision: 'city' });
  assert.equal(result.policyVersion, '1.0.0');
});

test('redactLocationForPublic strips exact coordinates for a living residence (maps)', () => {
  const publicLocation = redactLocationForPublic({
    precision: 'street_address',
    lat: 38.90721,
    lng: -77.03691,
    geohash: 'dqcjqcpe4',
    matchMethod: 'manual_research',
    label: '123 Main Street, Apt 4',
    livingStatus: 'unknown',
  });
  assert.ok(publicLocation);
  assert.equal(publicLocation.precision, 'city');
  // Coordinates are coarsened to city precision (2 decimals) no rooftop pin.
  assert.equal(publicLocation.lat, 38.91);
  assert.equal(publicLocation.lng, -77.04);
  // Geohash is truncated to the city cell.
  assert.equal(publicLocation.geohash, 'dqcj');
  // The address-bearing label is dropped.
  assert.equal(publicLocation.label, undefined);
  assert.equal(publicLocation.reductionReason, 'living_residential_precision_prohibited');
});

test('deep scrubber redacts address-shaped strings and protected keys (logs/telemetry)', () => {
  const redactor = createSensitiveDataRedactor();
  const scrubbed = redactor({
    note: 'Lives at 742 Evergreen Terrace near the school.',
    streetAddress: '742 Evergreen Terrace',
    lat: 38.90721,
    lng: -77.03691,
    nested: { residence: '1600 Pennsylvania Ave', kind: 'person' },
  }) as Record<string, unknown>;

  assert.equal(scrubbed.streetAddress, '[REDACTED]');
  assert.equal(scrubbed.lat, '[REDACTED]');
  assert.equal(scrubbed.lng, '[REDACTED]');
  assert.match(String(scrubbed.note), /\[REDACTED\] near the school/);
  const nested = scrubbed.nested as Record<string, unknown>;
  assert.equal(nested.residence, '[REDACTED]');
  assert.equal(nested.kind, 'person');
});

test('redactSensitiveValues scrubs exact coordinate pairs in free text', () => {
  const scrubbed = redactSensitiveValues('Pinned at 38.90721, -77.03691 exactly.') as string;
  assert.match(scrubbed, /\[REDACTED\]/);
  assert.doesNotMatch(scrubbed, /38\.90721/);
});

/**
 * Tests for precision reduction, location redaction, and the deep value scrubber, per
 * `docs/security/location-precision-standard.md`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSensitiveDataRedactor,
  reducePublicPrecision,
  redactLocationForPublic,
  redactSensitiveValues,
} from './index.ts';

test('unknown living status behaves as living for a person record', () => {
  const unknown = reducePublicPrecision({
    precision: 'address',
    kind: 'person',
    livingStatus: 'unknown',
  });
  const living = reducePublicPrecision({
    precision: 'address',
    kind: 'person',
    livingStatus: 'living',
  });
  assert.equal(unknown.reduced, true);
  assert.equal(unknown.reason, 'living_status_unknown');
  assert.equal(unknown.precision, 'city');
  assert.equal(living.reduced, true);
  assert.equal(living.reason, 'living_residence');
  assert.equal(living.precision, 'city');
});

test('omitted living status defaults to unknown (treat-as-living, fail-safe)', () => {
  const result = reducePublicPrecision({ precision: 'address', kind: 'person' });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'living_status_unknown');
  assert.equal(result.precision, 'city');
});

test('deceased person: no living-residence cap, address publishes at source precision', () => {
  const result = reducePublicPrecision({
    precision: 'address',
    kind: 'person',
    livingStatus: 'deceased',
  });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'address');
  assert.equal(result.reason, undefined);
});

test('living-residence rule only fires on the biographical axis: a place record is unaffected', () => {
  const result = reducePublicPrecision({
    precision: 'address',
    kind: 'place',
    livingStatus: 'living',
  });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'address');
});

test('a place whose sensitivityClass is living_residence is capped even though kind is not person', () => {
  const result = reducePublicPrecision({
    precision: 'address',
    kind: 'place',
    livingStatus: 'living',
    sensitivityClass: 'living_residence',
  });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'living_residence');
  assert.equal(result.precision, 'city');
});

test('occupied private residence of a deceased person is NOT reduced (NRHP publishes it at full address)', () => {
  const result = reducePublicPrecision({
    precision: 'address',
    kind: 'person',
    livingStatus: 'deceased',
    sensitivityClass: 'occupied_private_residence',
    occupiedPrivateResidence: true,
  });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'address');
});

test('a raw prohibited level fails closed to city, distinct from an unrecognized raw value', () => {
  for (const raw of ['unit', 'parcel', 'residence']) {
    const result = reducePublicPrecision({ precision: raw, livingStatus: 'deceased' });
    assert.equal(result.reduced, true, `raw="${raw}"`);
    assert.equal(result.reason, 'prohibited_location_precision', `raw="${raw}"`);
    assert.equal(result.precision, 'city', `raw="${raw}"`);
  }
});

test('exact_coordinates is unconditionally prohibited, regardless of neededForPublic', () => {
  const result = reducePublicPrecision({
    precision: 'exact_coordinates',
    livingStatus: 'deceased',
    neededForPublic: true,
  });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'exact_coordinates_reduced');
  assert.equal(result.precision, 'city');
});

test('withheld_on_request always wins, even over a living-residence cap', () => {
  const result = reducePublicPrecision({
    precision: 'address',
    kind: 'person',
    livingStatus: 'living',
    sensitivityClass: 'withheld_on_request',
  });
  assert.equal(result.reduced, true);
  assert.equal(result.reason, 'withheld_on_request');
  assert.equal(result.precision, 'none');
});

test('restricted_site caps to city; its legacy alias sensitive_site behaves the same', () => {
  const restricted = reducePublicPrecision({
    precision: 'address',
    kind: 'place',
    livingStatus: 'deceased',
    sensitivityClass: 'restricted_site',
  });
  const legacy = reducePublicPrecision({
    precision: 'address',
    kind: 'place',
    livingStatus: 'deceased',
    sensitivityClass: 'sensitive_site',
  });
  for (const result of [restricted, legacy]) {
    assert.equal(result.reduced, true);
    assert.equal(result.reason, 'restricted_site');
    assert.equal(result.precision, 'city');
  }
});

test('memorial_site publishes at source precision, no reduction', () => {
  const result = reducePublicPrecision({
    precision: 'site',
    kind: 'place',
    livingStatus: 'deceased',
    sensitivityClass: 'memorial_site',
  });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'site');
});

test('violence_associated, enslaver_or_segregationist, and perpetrator_associated publish at source precision', () => {
  for (const sensitivityClass of [
    'violence_associated',
    'enslaver_or_segregationist',
    'perpetrator_associated',
  ] as const) {
    const result = reducePublicPrecision({
      precision: 'address',
      kind: 'place',
      livingStatus: 'deceased',
      sensitivityClass,
    });
    assert.equal(result.reduced, false, sensitivityClass);
    assert.equal(result.precision, 'address', sensitivityClass);
  }
});

test('allowed coarse precision is not reduced', () => {
  const result = reducePublicPrecision({
    precision: 'city',
    livingStatus: 'living',
    kind: 'place',
  });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'city');
});

test('an unrecognized raw value normalizes to city (fail-safe default, not an error)', () => {
  const result = reducePublicPrecision({ precision: 'satellite_pinpoint' });
  assert.equal(result.reduced, false);
  assert.equal(result.precision, 'city');
  assert.equal(result.reason, undefined);
});

test('every reduction records the current policy version', () => {
  const result = reducePublicPrecision({ precision: 'city' });
  assert.equal(result.policyVersion, '1.1.0');
});

test('redactLocationForPublic caps a living person address to city (maps)', () => {
  const publicLocation = redactLocationForPublic({
    precision: 'address',
    kind: 'person',
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
  // The address-bearing label is dropped a reduced tier never keeps its source label.
  assert.equal(publicLocation.label, undefined);
  assert.equal(publicLocation.reductionReason, 'living_status_unknown');
});

test('redactLocationForPublic publishes an address-tier label for a deceased person (street address allowed)', () => {
  const publicLocation = redactLocationForPublic({
    precision: 'address',
    kind: 'person',
    lat: 38.90721,
    lng: -77.03691,
    geohash: 'dqcjqcpe4',
    matchMethod: 'manual_research',
    label: '123 Main Street',
    livingStatus: 'deceased',
  });
  assert.ok(publicLocation);
  assert.equal(publicLocation.precision, 'address');
  assert.equal(publicLocation.label, '123 Main Street');
  assert.equal(publicLocation.lat, 38.9072);
  assert.equal(publicLocation.reductionReason, undefined);
});

test('redactLocationForPublic never returns a location for a withheld-on-request record', () => {
  const publicLocation = redactLocationForPublic({
    precision: 'address',
    kind: 'place',
    lat: 38.90721,
    lng: -77.03691,
    sensitivityClass: 'withheld_on_request',
  });
  assert.equal(publicLocation, undefined);
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

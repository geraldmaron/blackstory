/**
 * Unit tests for the client-side coarse location analytics builder, mirroring
 * `packages/domain/src/geocode/analytics.ts`'s own test coverage so both stay behavior-identical.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCoarseLocationAnalyticsEvent,
  type CoarseAnalyticsResolutionLike,
} from './analytics-client';

const FIXED_NOW = () => '2026-01-01T00:00:00.000Z';

test('carries no coordinate/address/ZIP field, by construction, when a resolution is provided', () => {
  const resolution: CoarseAnalyticsResolutionLike = {
    jurisdictionIds: { stateId: 'us-11', countyId: 'us-11-001' },
    precision: { tier: 'exact-site' },
  };
  const event = buildCoarseLocationAnalyticsEvent('geocode_resolved', resolution, FIXED_NOW);
  assert.deepEqual(event, {
    kind: 'geocode_resolved',
    occurredAt: '2026-01-01T00:00:00.000Z',
    jurisdictionId: 'us-11-001',
    geoPrecisionTier: 'exact-site',
  });
  assert.ok(!('lat' in event) && !('lng' in event) && !('address' in event) && !('zip' in event));
});

test('prefers countyId over stateId when both are present', () => {
  const resolution: CoarseAnalyticsResolutionLike = {
    jurisdictionIds: { stateId: 'us-06', countyId: 'us-06-001' },
    precision: { tier: 'county' },
  };
  const event = buildCoarseLocationAnalyticsEvent('browser_location_used', resolution, FIXED_NOW);
  assert.equal(event.jurisdictionId, 'us-06-001');
});

test('falls back to stateId when no countyId is resolved', () => {
  const resolution: CoarseAnalyticsResolutionLike = {
    jurisdictionIds: { stateId: 'us-06' },
    precision: { tier: 'state' },
  };
  const event = buildCoarseLocationAnalyticsEvent('geocode_resolved', resolution, FIXED_NOW);
  assert.equal(event.jurisdictionId, 'us-06');
});

test('omits jurisdictionId/geoPrecisionTier entirely for a failed lookup (no resolution)', () => {
  const event = buildCoarseLocationAnalyticsEvent('geocode_failed', undefined, FIXED_NOW);
  assert.deepEqual(event, { kind: 'geocode_failed', occurredAt: '2026-01-01T00:00:00.000Z' });
});

test('manual_fallback_used carries no jurisdiction when there was no resolution', () => {
  const event = buildCoarseLocationAnalyticsEvent('manual_fallback_used', undefined, FIXED_NOW);
  assert.deepEqual(event, { kind: 'manual_fallback_used', occurredAt: '2026-01-01T00:00:00.000Z' });
});

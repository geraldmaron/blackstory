/**
 * Visit standing copy with present-day advisories.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PlaceAdvisoryRecord } from '@repo/domain/advisory';
import { resolveVisitAdvisoryStanding, resolveVisitStandingCopy } from './visit-advisory.js';

const advisory: PlaceAdvisoryRecord = {
  id: 'adv-1',
  placeEntityId: 'ent_place_001' as PlaceAdvisoryRecord['placeEntityId'],
  advisoryClass: 'site_lost',
  sourcedClaimIds: ['claim-property'],
  asOf: '2024-03-01',
  datePrecision: 'day',
  reviewCadence: 'annual',
};

describe('resolveVisitAdvisoryStanding', () => {
  it('builds a procedural advisory sentence from sourced claims', () => {
    const standing = resolveVisitAdvisoryStanding(
      [advisory],
      [{ id: 'claim-property', citationLabel: 'County assessor parcel record' }],
    );
    assert.match(standing ?? '', /Site no longer standing as of 2024-03-01/);
    assert.match(standing ?? '', /County assessor parcel record/);
  });
});

describe('resolveVisitStandingCopy', () => {
  it('prefers advisory standing over generic active status', () => {
    const standing = resolveVisitStandingCopy({
      kind: 'place',
      status: 'active',
      advisories: [advisory],
      claims: [{ id: 'claim-property', citationLabel: 'County assessor parcel record' }],
    });
    assert.match(standing ?? '', /Site no longer standing/);
    assert.doesNotMatch(standing ?? '', /Still standing/);
  });

  it('falls back to lifecycle standing when no advisory is present', () => {
    assert.equal(
      resolveVisitStandingCopy({ kind: 'school', status: 'active' }),
      'Still standing or operating today',
    );
  });
});

/**
 * Public address resolution and audit coverage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import {
  auditPublicAddressCoverage,
  isWithheldPublicAddress,
  resolvePublicAddressLine,
} from './public-address.js';

describe('resolvePublicAddressLine', () => {
  it('returns a sourced institution label as the public address', () => {
    assert.equal(
      resolvePublicAddressLine({
        kind: 'school',
        locationPrecision: 'institution',
        locationLabel: 'Paul Laurence Dunbar High School, 101 N Street NW, Washington, D.C.',
        jurisdictionLabel: 'Washington, D.C.',
        displayName: 'Paul Laurence Dunbar High School',
      }),
      'Paul Laurence Dunbar High School, 101 N Street NW, Washington, D.C.',
    );
  });

  it('strips schematic parentheticals from display copy', () => {
    assert.equal(
      resolvePublicAddressLine({
        kind: 'event',
        locationPrecision: 'campus',
        locationLabel: 'Paul Laurence Dunbar High School campus (schematic)',
        jurisdictionLabel: 'Washington, D.C.',
        displayName: 'D.C. Inventory of Historic Sites Listing (1975)',
      }),
      'Paul Laurence Dunbar High School campus',
    );
  });

  it('prefers the fuller jurisdiction string when the label is a city prefix', () => {
    assert.equal(
      resolvePublicAddressLine({
        kind: 'place',
        locationPrecision: 'city',
        locationLabel: 'Kiowa',
        jurisdictionLabel: 'Kiowa, Kansas',
        displayName: 'Sundown town of Kiowa',
      }),
      'Kiowa, Kansas',
    );
  });

  it('composes display name and jurisdiction when the label is withheld', () => {
    assert.equal(
      resolvePublicAddressLine({
        kind: 'place',
        locationPrecision: 'city',
        locationLabel: 'Place withheld',
        jurisdictionLabel: 'Montgomery, Alabama',
        displayName: 'Dexter Avenue Baptist Church',
      }),
      'Dexter Avenue Baptist Church, Montgomery, Alabama',
    );
  });
});

describe('isWithheldPublicAddress', () => {
  it('flags city-level disclaimers as non-address labels', () => {
    assert.equal(
      isWithheldPublicAddress(
        'Washington, D.C. (city-level pin; no specific street address documented)',
      ),
      true,
    );
  });
});

describe('auditPublicAddressCoverage', () => {
  it('flags visitable institution records stuck at city precision', () => {
    const issues = auditPublicAddressCoverage([
      {
        kind: 'institution',
        locationPrecision: 'city',
        locationLabel: 'Indianapolis, Indiana',
        displayName: 'Crispus Attucks Museum',
      },
    ]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.issue, 'city_only_visitable');
  });

  it('reports seed entities that still need address enrichment', () => {
    const entities = listPublicEntities();
    const issues = auditPublicAddressCoverage(entities, (entity, index) =>
      'id' in entity && typeof entity.id === 'string' ? entity.id : `index-${index}`,
    );
    assert.ok(Array.isArray(issues));
  });
});

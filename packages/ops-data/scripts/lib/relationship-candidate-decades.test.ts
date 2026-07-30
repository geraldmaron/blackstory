/**
 * Unit tests for relationship candidate decade derivation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEntityDecades } from './relationship-candidate-decades.ts';

test('deriveEntityDecades unions eraBuckets, statusHistory decades, and kind_detail EDTF', () => {
  const decades = deriveEntityDecades({
    kind: 'person',
    eraBuckets: ['1960s'],
    statusHistory: [{ status: 'active', validFrom: '1963-01-01', datePrecision: 'year', basisClaimIds: [] }],
    kindDetail: { birth_edtf: '1929', death_edtf: '1968' },
    referenceDate: '2026-07-01',
  });

  assert.ok(decades.includes('1960s'));
  assert.ok(decades.includes('1920s'));
});

test('deriveEntityDecades expands active place-like entities forward to the current decade', () => {
  const decades = deriveEntityDecades({
    kind: 'place',
    statusHistory: [
      { status: 'active', validFrom: '1900-01-01', datePrecision: 'year', basisClaimIds: [] },
    ],
    referenceDate: '2026-07-01',
  });

  assert.ok(decades.includes('1900s'));
  assert.ok(decades.includes('2020s'));
});

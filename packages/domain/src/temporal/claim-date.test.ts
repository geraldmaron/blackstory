/**
 * Deterministic claim-object date parsing for Stage 1 promotion.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildClaimTemporalQualifierDraft, parseCleanClaimObjectDate } from './claim-date.js';

test('parseCleanClaimObjectDate accepts bare year, ISO date, and Month DD, YYYY', () => {
  assert.deepEqual(parseCleanClaimObjectDate('1905'), { edtf: '1905', precision: 'year' });
  assert.deepEqual(parseCleanClaimObjectDate('1920-06-15'), {
    edtf: '1920-06-15',
    precision: 'day',
  });
  assert.deepEqual(parseCleanClaimObjectDate('March 4, 1865'), {
    edtf: '1865-03-04',
    precision: 'day',
  });
  assert.equal(parseCleanClaimObjectDate('Founded in the early twentieth century'), null);
});

test('buildClaimTemporalQualifierDraft maps predicate families to temporal properties', () => {
  const founded = buildClaimTemporalQualifierDraft('founded_year', '1905');
  assert.ok(founded);
  assert.equal(founded.property, 'start');
  assert.equal(founded.value.edtf, '1905');
  assert.equal(founded.value.provenance, 'deterministic');

  const death = buildClaimTemporalQualifierDraft('date_of_death', 'March 4, 1865');
  assert.ok(death);
  assert.equal(death.property, 'end');
  assert.equal(death.value.edtf, '1865-03-04');

  const event = buildClaimTemporalQualifierDraft('event_date', '1920-06-15');
  assert.ok(event);
  assert.equal(event.property, 'point_in_time');
});

/**
 * Smoke tests for legal component copy and status helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGAL_DISCLAIMER_BODY } from './copy';
import { humanizeLegalKind, isLawStatus, legalStatusDisplay } from './format';

test('the not-legal-advice line says so in words', () => {
  assert.match(LEGAL_DISCLAIMER_BODY, /not legal advice/);
  assert.doesNotMatch(LEGAL_DISCLAIMER_BODY, /—/);
});

test('humanizeLegalKind maps federal-statute', () => {
  assert.equal(humanizeLegalKind('federal-statute'), 'Federal statute');
});

test('legalStatusDisplay reads a status in words', () => {
  assert.equal(legalStatusDisplay('in_force'), 'In force');
  assert.equal(legalStatusDisplay('struck_down'), 'Struck down');
});

test('isLawStatus validates vocabulary', () => {
  assert.equal(isLawStatus('enjoined'), true);
  assert.equal(isLawStatus('invalid'), false);
});

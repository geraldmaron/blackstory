/**
 * Smoke tests for legal component copy and status helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGAL_DISCLAIMER_TITLE } from './copy';
import { humanizeLegalKind, isLawStatus, lawStatusTone, legalStatusDisplay } from './format';

test('legal disclaimer title is present', () => {
  assert.equal(LEGAL_DISCLAIMER_TITLE, 'Not legal advice');
});

test('humanizeLegalKind maps federal-statute', () => {
  assert.equal(humanizeLegalKind('federal-statute'), 'Federal statute');
});

test('lawStatusTone maps struck_down to error tone', () => {
  assert.equal(lawStatusTone('struck_down'), 'error');
  assert.equal(legalStatusDisplay('in_force'), 'In force');
});

test('isLawStatus validates vocabulary', () => {
  assert.equal(isLawStatus('enjoined'), true);
  assert.equal(isLawStatus('invalid'), false);
});

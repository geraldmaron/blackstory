/**
 * Tests for the trauma-content notice derivation, composing the existing 
 * `sensitive_content` disclaimer registry entry (../disclaimers.js).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveTraumaContentNotice } from './why-public-notice.js';

test('no notice is warranted when harm is not among the classified dimensions', () => {
  const decision = deriveTraumaContentNotice(['achievement', 'community']);
  assert.equal(decision.warranted, false);
  assert.equal(decision.disclaimer, undefined);
});

test('a notice is warranted when harm is classified, composed from the shared disclaimer registry', () => {
  const decision = deriveTraumaContentNotice(['harm', 'community']);
  assert.equal(decision.warranted, true);
  assert.ok(decision.disclaimer);
  assert.equal(decision.disclaimer?.class, 'sensitive_content');
  assert.ok(decision.disclaimer?.reviewDate);
});

test('a harm-only classification also warrants the notice', () => {
  const decision = deriveTraumaContentNotice(['harm']);
  assert.equal(decision.warranted, true);
});

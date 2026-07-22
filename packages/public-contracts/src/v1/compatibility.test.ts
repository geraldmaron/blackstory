import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clientBuildVersionSchema,
  evaluateCompatibility,
  isApiVersionBelowFloor,
  isBuildVersionBelowFloor,
} from './compatibility.js';

test('isApiVersionBelowFloor: v1 is not below the v1 floor', () => {
  assert.equal(isApiVersionBelowFloor('v1', 'v1'), false);
});

test('isApiVersionBelowFloor: malformed/unknown version strings fail closed (treated as below floor)', () => {
  assert.equal(isApiVersionBelowFloor('not-a-version', 'v1'), true);
  assert.equal(isApiVersionBelowFloor('', 'v1'), true);
});

test('isBuildVersionBelowFloor compares semver correctly', () => {
  const build100 = clientBuildVersionSchema.parse('mobile/1.0.0');
  const build140 = clientBuildVersionSchema.parse('mobile/1.4.0');
  assert.equal(isBuildVersionBelowFloor(build100, build140), true);
  assert.equal(isBuildVersionBelowFloor(build140, build100), false);
  assert.equal(isBuildVersionBelowFloor(build140, build140), false);
});

test('clientBuildVersionSchema rejects a malformed build string (adversarial: invalid format)', () => {
  assert.throws(() => clientBuildVersionSchema.parse('mobile-1.4.0'));
  assert.throws(() => clientBuildVersionSchema.parse('mobile/1.4'));
  assert.throws(() => clientBuildVersionSchema.parse('x'.repeat(200)));
});

test('evaluateCompatibility: current major is supported and not soft-deprecated', () => {
  const result = evaluateCompatibility({ clientApiVersion: 'v1' });
  assert.equal(result.supported, true);
  assert.equal(result.softDeprecated, false);
});

test('evaluateCompatibility: below-floor major is unsupported', () => {
  const result = evaluateCompatibility({ clientApiVersion: 'v0', floor: 'v1' });
  assert.equal(result.supported, false);
});

test('evaluateCompatibility: supported-but-not-current major is soft-deprecated, not hard-unsupported', () => {
  const result = evaluateCompatibility({ clientApiVersion: 'v1', floor: 'v1', isCurrentMajor: false });
  assert.equal(result.supported, true);
  assert.equal(result.softDeprecated, true);
});

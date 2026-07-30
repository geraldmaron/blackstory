/**
 * Unit tests for publish regression gate suite.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  lintStatusVocabulary,
  runMcGhieClassRegression,
  runPublishRegressionGates,
} from './publish-regression-gates.ts';

test('runMcGhieClassRegression passes when deceased lexicon derives and lints correctly', () => {
  const findings = runMcGhieClassRegression();
  assert.equal(findings.length, 0);
});

test('lintStatusVocabulary errors on unknown tokens', () => {
  const findings = lintStatusVocabulary({
    entityId: 'ent-1',
    status: 'totally_made_up',
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.code, 'unknown_status_token');
});

test('runPublishRegressionGates includes McGhie and status vocabulary checks', () => {
  const report = runPublishRegressionGates({
    projectionStatuses: [{ entityId: 'ent-1', status: 'active' }],
    graphNodeIds: ['a', 'b'],
    graphEdgeEndpointIds: ['a', 'b'],
  });
  assert.equal(report.hasErrors, false);
});

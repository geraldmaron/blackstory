/**
 * Unit tests for operator MCP error formatting.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OperatorMcpError, formatOperatorMcpError } from './errors.js';

describe('OperatorMcpError', () => {
  it('formats structured error payloads', () => {
    const error = new OperatorMcpError('unknown_metric', 'missing', { metricId: 'x' });
    assert.deepEqual(formatOperatorMcpError(error), {
      code: 'unknown_metric',
      message: 'missing',
      details: { metricId: 'x' },
    });
  });
});

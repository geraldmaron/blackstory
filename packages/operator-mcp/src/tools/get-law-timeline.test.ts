/**
 * Unit tests for get_law_timeline stub handler.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OperatorMcpError } from '../errors.js';
import { getLawTimeline } from './get-law-timeline.js';

describe('getLawTimeline', () => {
  it('returns stub status with empty timeline', async () => {
    const result = await getLawTimeline({ entityId: 'law:demo' });
    assert.equal(result.status, 'stub');
    assert.deepEqual(result.timeline, []);
    assert.match(result.message, /Phase 1/i);
  });

  it('accepts topicId + stateFips input', async () => {
    const result = await getLawTimeline({ topicId: 'criminal-justice', stateFips: '24' });
    assert.equal(result.status, 'stub');
  });

  it('requires entityId or topic/state pair', async () => {
    await assert.rejects(
      () => getLawTimeline({ topicId: 'criminal-justice' }),
      (error: unknown) => {
        assert.ok(error instanceof OperatorMcpError);
        assert.equal(error.code, 'invalid_input');
        return true;
      },
    );
  });
});

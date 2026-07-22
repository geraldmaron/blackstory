/**
 * Unit tests for get_entity_context tool handler.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JUXTAPOSITION_DISCLAIMER } from '../constants.js';
import {
  createMockIndicatorDbReader,
  SAMPLE_BINDING,
  SAMPLE_OBSERVATION,
  SAMPLE_SERIES,
} from '../test/mock-reader.js';
import { getEntityContext } from './get-entity-context.js';

describe('getEntityContext', () => {
  it('returns bindings, observations, and juxtaposition disclaimer', async () => {
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations: [SAMPLE_OBSERVATION],
      bindings: [SAMPLE_BINDING],
      jurisdictions: ['state:24'],
    });
    const result = await getEntityContext(reader, {
      entityId: 'topic:criminal-justice',
      purpose: 'mcp',
      referencePeriod: '2022',
    });
    assert.equal(result.juxtapositionDisclaimer, JUXTAPOSITION_DISCLAIMER);
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0]?.observation?.estimate, 912);
    assert.match(result.bindings[0]?.notes ?? '', /not a causal claim/i);
  });

  it('returns empty bindings without inventing metrics', async () => {
    const reader = createMockIndicatorDbReader({
      series: [],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    const result = await getEntityContext(reader, { entityId: 'law:unknown' });
    assert.deepEqual(result.bindings, []);
    assert.equal(result.juxtapositionDisclaimer, JUXTAPOSITION_DISCLAIMER);
  });
});

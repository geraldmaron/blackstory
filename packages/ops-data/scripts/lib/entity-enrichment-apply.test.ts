/** repo-n7p6.16 items 2/5 — review-sampling selector + ledger write shape. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyEnrichmentResult, isReviewSampled } from './entity-enrichment-apply.ts';
import type { EnrichmentAttempt } from './entity-enrichment-llm.ts';

describe('isReviewSampled', () => {
  it('is deterministic for the same entity, rate, and salt', () => {
    for (const id of ['ent_a_001', 'ent_b_001', 'ent_c_001']) {
      assert.equal(isReviewSampled(id, 0.5, 'salt'), isReviewSampled(id, 0.5, 'salt'));
    }
  });

  it('selects nothing at rate 0 and everything at rate 1', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `ent_${i}`);
    assert.equal(ids.filter((id) => isReviewSampled(id, 0)).length, 0);
    assert.equal(ids.filter((id) => isReviewSampled(id, 1)).length, 50);
    assert.equal(ids.filter((id) => isReviewSampled(id, Number.NaN)).length, 0);
  });

  it('samples roughly at the requested rate over a large population', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `ent_${i}`);
    const hit = ids.filter((id) => isReviewSampled(id, 0.05, '2026-08-06')).length;
    assert.ok(hit > 50 && hit < 150, `expected ~100 of 2000 at 5%, got ${hit}`);
  });

  it('varies the draw by salt so a batch date reshuffles the sample', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `ent_${i}`);
    const a = ids.filter((id) => isReviewSampled(id, 0.1, 'day-one')).join(',');
    const b = ids.filter((id) => isReviewSampled(id, 0.1, 'day-two')).join(',');
    assert.notEqual(a, b);
  });
});

describe('applyEnrichmentResult review-sample notes', () => {
  const acceptedAttempt: EnrichmentAttempt = {
    rawContent: '{}',
    validation: {
      ok: true,
      draft: {
        summary: 'S'.repeat(140),
        historicalContext: null,
        topicIds: [],
        eraBuckets: [],
        keywords: [],
        citations: [],
      },
    },
  } as unknown as EnrichmentAttempt;

  async function captureNotes(
    reviewSample: boolean | undefined,
  ): Promise<Record<string, unknown>> {
    let captured: unknown;
    const client = {
      query: (_sql: string, params: unknown[]) => {
        captured = params[5];
        return Promise.resolve({ rows: [], rowCount: 1 });
      },
    };
    await applyEnrichmentResult(client as never, {
      entityId: 'ent_x_001',
      attempt: acceptedAttempt,
      modelId: 'test-model',
      costUsdEstimate: 0,
      ...(reviewSample !== undefined ? { reviewSample } : {}),
    });
    return JSON.parse(captured as string) as Record<string, unknown>;
  }

  it('writes notes.reviewSample when sampled', async () => {
    const notes = await captureNotes(true);
    assert.deepEqual(notes.reviewSample, {
      selected: true,
      reason: 'random-audit-of-passing-output',
    });
  });

  it('omits notes.reviewSample when not sampled', async () => {
    const notes = await captureNotes(false);
    assert.equal('reviewSample' in notes, false);
    const notesDefault = await captureNotes(undefined);
    assert.equal('reviewSample' in notesDefault, false);
  });
});

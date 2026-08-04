/**
 * Unit tests for the model routing policy (repo-xez5.2): lane -> tier table, free-roster
 * failover through the routed provider, low-confidence/disagreement escalation, verifier
 * independence, and cost estimation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LANE_ROUTING_POLICY,
  createLaneProvider,
  estimateCostUsd,
  pickIndependentVerifierModel,
  shouldEscalateToPaid,
  withLaneMetadata,
} from './model-routing.ts';

test('every research lane declares a tier that matches bb_research.runs.mode vocabulary', () => {
  const validModes = new Set([
    'deterministic',
    'local-triage',
    'free-batch',
    'paid-research',
    'quality-prose',
    'independent-review',
    'trusted-session',
  ]);
  for (const policy of Object.values(LANE_ROUTING_POLICY)) {
    assert.ok(validModes.has(policy.tier), `${policy.lane} has invalid tier ${policy.tier}`);
  }
});

test('routing table assigns the documented tiers', () => {
  assert.equal(LANE_ROUTING_POLICY['research-intake'].tier, 'local-triage');
  assert.equal(LANE_ROUTING_POLICY['discovery-run'].tier, 'local-triage');
  assert.equal(LANE_ROUTING_POLICY['editorial-enrichment'].tier, 'free-batch');
  assert.equal(LANE_ROUTING_POLICY['story-craft'].tier, 'quality-prose');
  assert.equal(LANE_ROUTING_POLICY['theme-study'].tier, 'quality-prose');
  assert.equal(LANE_ROUTING_POLICY['case-drafting'].tier, 'deterministic');
});

test('local-triage lane provider fails free roster over to ollama', async () => {
  let openrouterCalls = 0;
  let ollamaCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('openrouter.ai')) {
      openrouterCalls += 1;
      return new Response('rate limited', { status: 429 });
    }
    if (url.includes('/api/chat')) {
      ollamaCalls += 1;
      return Response.json({
        message: { role: 'assistant', content: '{"decision":"keep"}' },
        model: 'qwen3:8b',
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const provider = createLaneProvider('research-intake', {
    apiKey: 'test-key',
    freeRoster: ['openai/gpt-oss-20b:free'],
    fetchImpl,
  });
  const result = await provider.complete({
    model: '',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(result.servedBy, 'ollama');
  // Hybrid's internal openrouter provider defaults to 2 attempts before failing over, even
  // with a single-model roster (retryable 429 is retried once against the same model).
  assert.equal(openrouterCalls, 2);
  assert.equal(ollamaCalls, 1);
});

test('editorial-enrichment escalates below the confidence threshold', () => {
  assert.equal(
    shouldEscalateToPaid('editorial-enrichment', { confidence: 0.4, decision: 'keep' }),
    true,
  );
  assert.equal(
    shouldEscalateToPaid('editorial-enrichment', { confidence: 0.9, decision: 'keep' }),
    false,
  );
});

test('editorial-enrichment escalates on disagreement even with high confidence', () => {
  const escalate = shouldEscalateToPaid(
    'editorial-enrichment',
    { confidence: 0.9, decision: 'keep' },
    { confidence: 0.9, decision: 'weed' },
  );
  assert.equal(escalate, true);
});

test('lanes without an escalation threshold never escalate', () => {
  assert.equal(shouldEscalateToPaid('story-craft', { confidence: 0.01, decision: 'keep' }), false);
});

test('pickIndependentVerifierModel rejects the producer family', () => {
  const verifier = pickIndependentVerifierModel('deepseek/deepseek-v3.2', [
    'deepseek/deepseek-r1-0528',
    'moonshotai/kimi-k2.5',
  ]);
  assert.equal(verifier, 'moonshotai/kimi-k2.5');
});

test('pickIndependentVerifierModel throws when no independent model is available', () => {
  assert.throws(
    () => pickIndependentVerifierModel('deepseek/deepseek-v3.2', ['deepseek/deepseek-r1-0528']),
    /independent of producer family/,
  );
});

test('estimateCostUsd treats free-suffixed models as zero cost', () => {
  assert.equal(
    estimateCostUsd('openai/gpt-oss-20b:free', { promptTokens: 10_000, completionTokens: 5_000 }),
    0,
  );
});

test('estimateCostUsd computes from the price table for a known paid model', () => {
  const cost = estimateCostUsd('deepseek/deepseek-v3.2', {
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.ok(cost > 0);
});

test('withLaneMetadata attaches lane, tier, and a cost estimate to the completion', async () => {
  const wrapped = withLaneMetadata('story-craft', {
    id: 'mock',
    async complete() {
      return {
        content: '{}',
        provider: 'mock',
        modelId: 'deepseek/deepseek-v3.2',
        usage: { promptTokens: 100, completionTokens: 50 },
      };
    },
  });
  const result = await wrapped.complete({ model: '', messages: [] });
  assert.equal(result.lane, 'story-craft');
  assert.equal(result.tier, 'quality-prose');
  assert.ok(result.costUsdEstimate > 0);
});

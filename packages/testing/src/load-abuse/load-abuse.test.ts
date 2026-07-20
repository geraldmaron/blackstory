/**
 * acceptance tests: load, abuse, and cost simulations against security guardrails.
 * No live network attacks fixtures import @repo/security evaluators directly.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_LOAD_ABUSE_SCENARIO_IDS,
  assertPublicServingUnderBudgetPressure,
  estimateScenarioCosts,
  loadAbuseTuningRecommendations,
  proveLayeredControls,
  runAllLoadAbuseScenarios,
  tuningRecommendationsByPriority,
} from './index.js';

describe(' load and abuse scenarios', () => {
  it('covers all twelve required scenario ids', () => {
    assert.equal(ALL_LOAD_ABUSE_SCENARIO_IDS.length, 12);
    const runs = runAllLoadAbuseScenarios();
    assert.equal(runs.length, 12);
    const ids = new Set(runs.map((row) => row.scenarioId));
    for (const expected of ALL_LOAD_ABUSE_SCENARIO_IDS) {
      assert.ok(ids.has(expected), `missing scenario ${expected}`);
    }
  });

  it('denies abusive traffic in every scenario (at least one denial)', () => {
    for (const { result } of runAllLoadAbuseScenarios()) {
      assert.ok(
        result.deniedCount > 0 || result.layersTriggered.length > 0,
        `${result.scenarioId} must trigger controls`,
      );
    }
  });

  it('keeps services within configured resource caps', () => {
    for (const { result } of runAllLoadAbuseScenarios()) {
      assert.equal(result.withinResourceCaps, true, `${result.scenarioId} exceeded caps`);
    }
  });

  it('preserves public static availability when expensive features throttle', () => {
    for (const { result } of runAllLoadAbuseScenarios()) {
      if (result.scenarioId === 'high_volume_static' || result.scenarioId === 'scraping_patterns') {
        assert.equal(result.publicStaticPreserved, true, result.scenarioId);
      }
    }
    assert.equal(assertPublicServingUnderBudgetPressure(), true);
  });
});

describe(' layered control independence', () => {
  it('does not rely on a single control layer across abusive scenarios', () => {
    const multiLayer = runAllLoadAbuseScenarios().filter(
      ({ proof }) => proof.independentLayers >= 2,
    );
    assert.ok(
      multiLayer.length >= 6,
      `expected most scenarios to trigger >=2 layers, got ${multiLayer.length}`,
    );
  });

  it('survives single-layer bypass when rate and resource families both present', () => {
    const resilient = runAllLoadAbuseScenarios().filter(
      ({ proof }) => proof.survivesSingleLayerBypass,
    );
    assert.ok(
      resilient.length >= 4,
      `expected cross-family layering in >=4 scenarios, got ${resilient.length}`,
    );
  });

  it('documents independent families for search flood and geocoder abuse', () => {
    const search = runAllLoadAbuseScenarios().find((row) => row.scenarioId === 'search_flood');
    const geocoder = runAllLoadAbuseScenarios().find((row) => row.scenarioId === 'geocoder_abuse');
    assert.ok(search);
    assert.ok(geocoder);
    assert.ok(search!.proof.independentLayers >= 2);
    assert.ok(geocoder!.proof.independentLayers >= 2);
    assert.equal(
      proveLayeredControls('search_flood', search!.result.layersTriggered).independentLayers >= 1,
      true,
    );
  });
});

describe(' cost and tuning outputs', () => {
  it('documents cost per abusive request for every scenario', () => {
    const costs = estimateScenarioCosts();
    assert.equal(costs.length, 12);
    for (const row of costs) {
      assert.ok(row.perRequestCostUnits >= 0);
      assert.ok(row.notes.length > 10, `${row.scenarioId} notes too thin`);
    }
  });

  it('denied requests carry zero marginal cost in simulations', () => {
    for (const { result } of runAllLoadAbuseScenarios()) {
      if (result.deniedCount === result.stepsExecuted) {
        assert.equal(
          result.totalEstimatedCostUnits,
          0,
          `${result.scenarioId} should be zero-cost when fully denied`,
        );
      }
    }
  });

  it('emits concrete tuning recommendations with P0 items', () => {
    const all = loadAbuseTuningRecommendations();
    assert.ok(all.length >= 10);
    const p0 = tuningRecommendationsByPriority('P0');
    assert.ok(p0.length >= 3);
    for (const row of all) {
      assert.match(row.id, /^tune-/);
      assert.ok(row.rationale.length > 20);
    }
  });
});

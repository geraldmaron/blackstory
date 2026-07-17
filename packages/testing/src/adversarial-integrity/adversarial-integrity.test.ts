/**
 * BB-060 acceptance tests: adversarial integrity scenarios against real domain/security gates.
 * No live network attacks — fixtures import evaluators directly from workspace packages.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recalculateConfidence } from '@black-book/domain';
import {
  ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS,
  DOCUMENTED_CONTROL_GAPS,
  claimEvidenceLink,
  proveLineageVolumeDefense,
  provePublicContentIsolation,
  provePublicLanguageDefense,
  runAllAdversarialIntegrityScenarios,
} from './index.js';

describe('BB-060 adversarial integrity scenarios', () => {
  it('covers all eleven required scenario ids', () => {
    assert.equal(ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS.length, 11);
    const runs = runAllAdversarialIntegrityScenarios();
    assert.equal(runs.length, 11);
    const ids = new Set(runs.map((row) => row.scenarioId));
    for (const expected of ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS) {
      assert.ok(ids.has(expected), `missing scenario ${expected}`);
    }
  });

  it('blocks every adversarial attack path (AC1)', () => {
    for (const { result } of runAllAdversarialIntegrityScenarios()) {
      assert.equal(result.attackBlocked, true, `${result.scenarioId} must block the attack`);
      assert.equal(
        provePublicContentIsolation(result),
        true,
        `${result.scenarioId} must not mutate public content`,
      );
      assert.equal(result.publicContentMutated, false, `${result.scenarioId} public mutation flag`);
    }
  });

  it('prevents volume-based lineage inflation where applicable (AC2)', () => {
    const lineageScenarios = runAllAdversarialIntegrityScenarios().filter(
      ({ result }) => result.lineageInflationPrevented !== undefined,
    );
    assert.ok(lineageScenarios.length >= 2);
    for (const { result } of lineageScenarios) {
      assert.equal(
        proveLineageVolumeDefense(result),
        true,
        `${result.scenarioId} must collapse repeated lineages`,
      );
    }
  });

  it('constrains inflated procedural and identity language (AC3)', () => {
    const languageScenarios = runAllAdversarialIntegrityScenarios().filter(
      ({ result }) => result.publicLanguageConstrained !== undefined,
    );
    assert.ok(languageScenarios.length >= 2);
    for (const { result } of languageScenarios) {
      assert.equal(
        provePublicLanguageDefense(result),
        true,
        `${result.scenarioId} must constrain public language`,
      );
    }
  });

  it('records real control layers for every scenario', () => {
    for (const { result } of runAllAdversarialIntegrityScenarios()) {
      assert.ok(result.controlsTriggered.length >= 1, `${result.scenarioId} must name controls`);
      for (const control of result.controlsTriggered) {
        assert.ok(control.reason.length > 0, `${result.scenarioId}/${control.layer}`);
      }
    }
  });

  it('documents no open control gaps — existing controls held (AC4)', () => {
    assert.deepEqual(DOCUMENTED_CONTROL_GAPS, []);
  });
});

describe('BB-060 positive controls', () => {
  it('still allows strong entity-match confidence when identification is sound', () => {
    const strongMatch = recalculateConfidence({
      claimClass: 'standard',
      calculatedAt: '2026-07-17T04:00:00.000Z',
      evidenceLinks: [
        claimEvidenceLink('strong-match', 'lineage-a', { entityMatchQuality: 0.95 }),
        claimEvidenceLink('strong-match-b', 'lineage-b', { entityMatchQuality: 0.92 }),
      ],
    });
    assert.equal(strongMatch.passesPublishThreshold, true);
  });
});

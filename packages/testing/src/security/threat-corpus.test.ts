/**
 * Automated BB-004 acceptance checks for the threat / abuse corpus.
 * Full security CI gates land in BB-036; this scaffold only validates the corpus.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REQUIRED_ABUSE_CASE_IDS,
  REQUIRED_THREAT_IDS,
  loadThreatCorpus,
  validateThreatCorpus,
} from './threat-corpus.ts';

describe('BB-004 threat corpus', () => {
  it('loads nineteen P0 threats with full control quadrants and bead maps', () => {
    const corpus = loadThreatCorpus();
    const issues = validateThreatCorpus(corpus);
    assert.deepEqual(issues, [], issues.map((i) => `${i.code}: ${i.message}`).join('\n'));
  });

  it('exposes stable required id lists for checklist scaffolding', () => {
    assert.equal(REQUIRED_THREAT_IDS.length, 19);
    assert.equal(REQUIRED_ABUSE_CASE_IDS.length, 19);
    assert.equal(REQUIRED_THREAT_IDS[0], 'T-01');
    assert.equal(REQUIRED_ABUSE_CASE_IDS[18], 'AC-19');
  });

  it('documents residual risk on every threat', () => {
    const corpus = loadThreatCorpus();
    for (const threat of corpus.threats) {
      assert.ok(threat.residualRisk.length > 20, `${threat.id} residual risk too thin`);
    }
  });
});

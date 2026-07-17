/**
 * BB-023 acceptance checks for Cloud Armor and ingress design artifacts.
 * Validates JSON schema, required rules, and LB-only ingress assertions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARMOR_DIR = __dirname;

function readJson(relativePath) {
  const raw = readFileSync(join(ARMOR_DIR, relativePath), 'utf8');
  return JSON.parse(raw);
}

function assertRequiredRuleRules(policy, requirements) {
  for (const req of requirements) {
    const rule = policy.rules.find((r) => r.priority === req.priority);
    assert.ok(rule, `${policy.name}: missing rule priority ${req.priority}`);
    if (req.action) assert.equal(rule.action, req.action);
    if (req.exceedAction) {
      assert.equal(rule.rateLimitOptions?.exceedAction, req.exceedAction);
    }
    if (req.preview !== undefined) assert.equal(rule.preview, req.preview);
  }
}

describe('BB-023 ingress matrix', () => {
  it('asserts internet traffic only through LB and direct run.app disabled', () => {
    const matrix = readJson('ingress-matrix.json');
    assert.equal(matrix.bead, 'BB-023');
    assert.equal(matrix.internetTrafficOnlyThroughLb, true);
    assert.equal(matrix.directRunAppUrlsDisabled, true);
    assert.equal(matrix.geoControls.enabled, false);
    assert.equal(matrix.emergencyDeny.activateWithoutDeploy, true);

    for (const backend of matrix.backends) {
      assert.equal(
        backend.cloudRunIngress,
        'internal-and-cloud-load-balancing',
        `${backend.id} must not allow public run.app ingress`
      );
    }
  });

  it('maps both public APIs to serverless NEGs and Armor policies', () => {
    const matrix = readJson('ingress-matrix.json');
    const ids = matrix.backends.map((b) => b.id).sort();
    assert.deepEqual(ids, ['api-public', 'api-submissions']);

    for (const backend of matrix.backends) {
      assert.ok(backend.serverlessNeg?.name);
      assert.match(backend.armorPolicyRef, /^policies\/.+\.json$/);
    }
  });

  it('defines four acceptance criteria', () => {
    const matrix = readJson('ingress-matrix.json');
    const acIds = matrix.acceptanceCriteria.map((a) => a.id).sort();
    assert.deepEqual(acIds, [
      'AC-ARMOR-1',
      'AC-ARMOR-2',
      'AC-ARMOR-3',
      'AC-ARMOR-4',
    ]);
  });
});

describe('BB-023 Cloud Armor policies', () => {
  const policyFiles = [
    'policies/api-public-policy.json',
    'policies/api-submissions-policy.json',
  ];

  for (const file of policyFiles) {
    it(`${file} parses and includes emergency, WAF, rate-limit, and default rules`, () => {
      const policy = readJson(file);
      assert.equal(policy.type, 'CLOUD_ARMOR');
      assert.equal(policy.projectId, 'black-book-efaaf');
      assert.ok(policy.rules.length >= 5);

      assertRequiredRuleRules(policy, [
        { priority: 10, action: 'allow' },
        { priority: 100, action: 'deny(403)' },
        { priority: 110, action: 'deny(403)' },
        { priority: 120, action: 'deny(403)' },
        { priority: 200, action: 'rate_based_ban', exceedAction: 'deny(429)' },
        { priority: 900, preview: true },
        { priority: 2147483647, action: 'allow' },
      ]);
    });
  }

  it('api-submissions has stricter rate limits than api-public', () => {
    const pub = readJson('policies/api-public-policy.json');
    const sub = readJson('policies/api-submissions-policy.json');
    const pubGlobal = pub.rules.find((r) => r.priority === 210);
    const subGlobal = sub.rules.find((r) => r.priority === 210);
    assert.ok(
      subGlobal.rateLimitOptions.rateLimitThreshold.count <
        pubGlobal.rateLimitOptions.rateLimitThreshold.count,
      'submissions global ceiling must be lower than api-public'
    );
  });
});

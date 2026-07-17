/**
 * Validates BB-034 security alert and dashboard design stubs.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const alertPolicies = JSON.parse(
  await readFile(new URL('./security-alert-policies.json', import.meta.url), 'utf8'),
);
const dashboard = JSON.parse(
  await readFile(new URL('./security-dashboard.json', import.meta.url), 'utf8'),
);

test('alert policies are design-only with required BB-034 metadata', () => {
  assert.equal(alertPolicies.status, 'design-only');
  assert.equal(alertPolicies.bead, 'BB-034');
  assert.equal(alertPolicies.projectId, 'black-book-efaaf');
  assert.ok(alertPolicies.policies.length >= 19);
});

test('every alert policy includes severity, runbook, metric, and notification channels', () => {
  for (const policy of alertPolicies.policies) {
    assert.match(policy.id, /^SEC-/);
    assert.ok(['info', 'warning', 'critical'].includes(policy.severity));
    assert.match(policy.runbookId, /^runbook\//);
    assert.ok(policy.metric.length > 0);
    assert.ok(policy.notificationChannels.length >= 1);
    assert.equal(policy.enabled, true);
  }
});

test('immediate notification policies cover administrator and publication events', () => {
  const immediate = alertPolicies.policies.filter((policy) => policy.immediateNotification);
  const ids = new Set(immediate.map((policy) => policy.id));
  assert.ok(ids.has('SEC-ADMIN-01'));
  assert.ok(ids.has('SEC-PUB-01'));
  assert.ok(ids.has('SEC-RET-01'));
  assert.ok(ids.has('SEC-DB-02'));
  for (const policy of immediate) {
    assert.ok(policy.notificationChannels.includes('pager'));
  }
});

test('dashboard stub covers BB-034 deliverable panels', () => {
  assert.equal(dashboard.status, 'design-only');
  assert.equal(dashboard.dashboardId, 'black-book-security-telemetry');
  const titles = dashboard.panels.map((panel) => panel.id);
  const required = [
    'armor-throttle-deny',
    'app-check-failures',
    'auth-failures',
    'admin-role-changes',
    'submission-volume',
    'search-geocoder-abuse',
    'database-health',
    'queue-depth-retries',
    'source-adapter-anomalies',
    'publication-retraction',
    'unexpected-public-writes',
    'storage-denials',
    'error-rate-latency',
    'cost-anomaly-score',
  ];
  for (const id of required) {
    assert.ok(titles.includes(id), `missing panel ${id}`);
  }
});

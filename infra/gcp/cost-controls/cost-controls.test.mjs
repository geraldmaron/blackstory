/**
 * Acceptance checks for cost and resource exhaustion control artifacts.
 * Validates JSON schema, bounded scaling, retry policies, soft-shutdown ordering,
 * and billing alert / automated response pairing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COST_DIR = __dirname;

function readJson(relativePath) {
  const raw = readFileSync(join(COST_DIR, relativePath), 'utf8');
  return JSON.parse(raw);
}

describe('BB-033 cost controls matrix', () => {
  it('declares BB-033 bead and dependency refs', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.equal(matrix.bead, 'BB-033');
    assert.deepEqual(matrix.dependencyRefs.sort(), ['BB-022', 'BB-023', 'BB-025']);
    assert.equal(matrix.status, 'design');
  });

  it('bounds maxInstances for every Cloud Run and App Hosting backend', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.ok(matrix.services.length >= 5);

    for (const service of matrix.services) {
      assert.ok(
        service.maxInstances >= 1 && service.maxInstances <= 100,
        `${service.id} maxInstances`,
      );
      assert.ok(service.minInstances <= service.maxInstances, `${service.id} min/max`);
      assert.ok(service.concurrency >= 1, `${service.id} concurrency`);
    }

    const web = matrix.services.find((s) => s.id === 'web');
    assert.equal(web.maxInstances, 6);
    assert.equal(web.runtime, 'vercel');
    assert.equal(web.bb022Ref, 'docs/runbooks/vercel-public-web-cutover.md');
  });

  it('defines Cloud Tasks rate, concurrency, depth, and retry limits', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.ok(matrix.cloudTasksQueues.length >= 5);

    for (const queue of matrix.cloudTasksQueues) {
      assert.ok(queue.maxDispatchesPerSecond > 0);
      assert.ok(queue.maxConcurrentDispatches >= 1);
      assert.ok(queue.maxQueueDepth >= 100);
      assert.ok(queue.retry.maxAttempts >= 1 && queue.retry.maxAttempts <= 10);
      assert.ok(queue.retry.maxBackoffMs >= queue.retry.initialBackoffMs);
      assert.ok(queue.retry.multiplier >= 1.5);
    }
  });

  it('defines per-job CPU, memory, duration, and retry limits', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.ok(matrix.cloudRunJobs.length >= 6);

    for (const job of matrix.cloudRunJobs) {
      assert.ok(job.cpu >= 0.25);
      assert.ok(job.memoryMiB >= 128);
      assert.ok(job.maxDurationSec >= 60);
      assert.ok(job.retry.maxAttempts >= 1);
    }
  });

  it('never auto-disables public corpus and shuts down optional research first', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.equal(matrix.softShutdown.autoDisablePublicCorpus, false);
    assert.ok(matrix.softShutdown.preserveTiers.includes('public_serving'));

    const order = matrix.softShutdown.shutdownOrder;
    const optionalIdx = order.indexOf('optional_research');
    const essentialIdx = order.indexOf('essential_ops');
    assert.ok(optionalIdx >= 0 && essentialIdx >= 0);
    assert.ok(optionalIdx < essentialIdx);
  });

  it('pairs billing alerts with automated responses', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.ok(matrix.billingAlerts.length >= 4);

    for (const alert of matrix.billingAlerts) {
      assert.ok(alert.automatedResponse);
      assert.ok(alert.runbookRef.includes('hard-stop-runbook'));
      assert.ok(alert.notifyChannels.length >= 1);
    }

    const at100 = matrix.billingAlerts.find((a) => a.thresholdPercent === 100);
    assert.ok(at100);
    assert.notEqual(at100.automatedResponse, 'alert_only');
  });

  it('maps five acceptance criteria', () => {
    const matrix = readJson('cost-controls-matrix.json');
    const ids = matrix.acceptanceCriteria.map((a) => a.id).sort();
    assert.deepEqual(ids, ['AC-COST-1', 'AC-COST-2', 'AC-COST-3', 'AC-COST-4', 'AC-COST-5']);
  });
});

describe('BB-033 daily budgets', () => {
  it('includes geocoder, model, OCR, source, and research campaign caps', () => {
    const matrix = readJson('cost-controls-matrix.json');
    const categories = matrix.dailyBudgets.map((b) => b.category).sort();
    assert.deepEqual(categories, ['geocoder', 'model', 'ocr', 'research_campaign', 'source_fetch']);

    for (const budget of matrix.dailyBudgets) {
      assert.equal(budget.hardStopAtPercent, 100);
      assert.ok(budget.softShutdownAtPercent < 100);
      assert.ok(budget.dailyCap > 0);
    }
  });
});

describe('BB-033 database limits', () => {
  it('defines connection and statement timeouts per role', () => {
    const matrix = readJson('cost-controls-matrix.json');
    assert.ok(matrix.databaseLimits.length >= 4);

    for (const row of matrix.databaseLimits) {
      assert.ok(row.maxConnections >= 1);
      assert.ok(row.statementTimeoutMs >= 1000);
      assert.ok(row.idleTransactionTimeoutMs >= 1000);
      assert.ok(row.lockTimeoutMs >= 500);
    }
  });
});

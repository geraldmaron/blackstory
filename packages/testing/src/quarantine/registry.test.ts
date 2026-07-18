
/**
 * Quarantine registry validation: owner + deadline required; expired entries fail.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertQuarantineRegistryHealthy,
  isQuarantined,
  loadQuarantineRegistry,
  validateQuarantineRegistry,
} from './registry.ts';

test('default quarantine registry loads and is healthy', () => {
  const registry = loadQuarantineRegistry();
  assert.equal(registry.version, 1);
  assert.deepEqual(registry.entries, []);
  assert.doesNotThrow(() => assertQuarantineRegistryHealthy(registry, new Date('2026-07-16')));
});

test('expired quarantine entries fail closed', () => {
  const issues = validateQuarantineRegistry(
    {
      version: 1,
      entries: [
        {
          id: 'flaky.example',
          owner: '@repo/platform',
          deadline: '2026-01-01',
          reason: 'intermittent timing',
        },
      ],
    },
    new Date('2026-07-16T00:00:00.000Z'),
  );
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? '', /expired/);
});

test('isQuarantined finds entries by id', () => {
  const registry = {
    version: 1,
    entries: [
      {
        id: 'suite.case',
        owner: '@owner',
        deadline: '2099-01-01',
        reason: 'known flake',
      },
    ],
  };
  assert.equal(isQuarantined('suite.case', registry)?.owner, '@owner');
  assert.equal(isQuarantined('missing', registry), undefined);
});

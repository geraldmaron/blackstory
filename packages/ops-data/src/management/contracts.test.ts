import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('browser work contracts load and parse without string code generation', () => {
  const script = `
    const { workRequestSchema, workExecutionMode } = await import(${JSON.stringify(new URL('./contracts.ts', import.meta.url).href)});
    const request = workRequestSchema.parse({
      request: 'Research one school', sessionId: 'test', harness: 'browser', idempotencyKey: 'test'
    });
    if (workExecutionMode(request) !== 'session') throw new Error('Wrong default execution mode');
    if (workExecutionMode({...request, executionMode: 'hosted'}) !== 'hosted') throw new Error('Wrong explicit mode');
  `;
  const result = spawnSync(
    process.execPath,
    [
      '--disallow-code-generation-from-strings',
      '--conditions',
      'development',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      script,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});

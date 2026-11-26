import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mapPool } from '../../../operator-cli/src/map-pool.ts';
import { codexExecArgs, runCodexExec } from './codex-exec.ts';

test('codex args keep stdin last and put -c settings after the model', () => {
  const args = codexExecArgs({
    model: 'gpt-6.1-sol',
    workDir: '/w',
    schemaPath: '/w/s.json',
    outputPath: '/w/o.json',
    prompt: 'p',
    timeoutMs: 1,
    config: ['web_search=live'],
  });
  assert.deepEqual(args.slice(0, 5), ['exec', '-m', 'gpt-6.1-sol', '-c', 'web_search=live']);
  assert.equal(args.at(-1), '-');
});

test('calls run concurrently and each gets its prompt on stdin', async () => {
  // A stand-in `codex` that waits a second, then writes its stdin to the -o path.
  const dir = mkdtempSync(join(tmpdir(), 'codex-exec-'));
  const fake = join(dir, 'codex');
  writeFileSync(
    fake,
    '#!/bin/sh\nout=""\nwhile [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done\n' +
      'sleep 1\ncat > "$out"\n',
  );
  chmodSync(fake, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${dir}:${previousPath ?? ''}`;
  try {
    const started = Date.now();
    const results = await mapPool(
      [0, 1, 2, 3],
      (index) =>
        runCodexExec({
          model: 'm',
          workDir: dir,
          schemaPath: join(dir, 's.json'),
          outputPath: join(dir, `out-${index}.json`),
          prompt: `prompt ${index}`,
          timeoutMs: 10_000,
        }),
      { concurrency: 4 },
    );
    const elapsed = Date.now() - started;
    assert.ok(results.every((result) => result.status === 0));
    assert.equal(readFileSync(join(dir, 'out-2.json'), 'utf8'), 'prompt 2');
    // Four one-second calls in series take four seconds; in parallel, about one.
    assert.ok(elapsed < 2_500, `took ${elapsed} ms`);
  } finally {
    process.env.PATH = previousPath;
  }
});

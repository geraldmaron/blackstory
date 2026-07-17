/**
 * Verifies the CLI is a thin dispatcher: it parses flags, calls the real prepare/commit
 * functions, and is safe-by-default (no writes without an explicit `--commit`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AtomicStore, AtomicTransaction } from '@black-book/firebase';
import { runCli } from './cli.ts';

class MemoryAtomicStore implements AtomicStore {
  readonly writes: string[] = [];
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
    const staged: { path: string; data: Readonly<Record<string, unknown>> }[] = [];
    const transaction: AtomicTransaction = {
      get: async (path) => {
        const value = this.documents.get(path);
        return { exists: value !== undefined, data: () => value };
      },
      create: (path, data) => staged.push({ path, data }),
      set: (path, data) => staged.push({ path, data }),
      update: (path, data) => staged.push({ path, data }),
    };
    const result = await operation(transaction);
    for (const item of staged) {
      this.documents.set(item.path, item.data);
      this.writes.push(item.path);
    }
    return result;
  }
}

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    stdout: (line: string) => lines.push(line),
    stderr: (line: string) => errors.push(line),
  };
}

const BASE_FLAGS = [
  '--operator-id',
  'operator-1',
  '--session-id',
  'session-1',
  '--privacy-pepper',
  'test-only-pepper',
];

test('submit-lead without --commit prepares an outcome but writes nothing', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'submit-lead',
      '--description',
      'A lead with a citation, exercised through the CLI dispatcher.',
      '--url',
      'https://archive.example.org/cli-test',
      ...BASE_FLAGS,
    ],
    { store, stdout: out.stdout, stderr: out.stderr, nowMs: Date.parse('2026-07-17T04:00:00.000Z') },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
  assert.equal(result.committed, false);
  assert.equal(store.writes.length, 0);
});

test('submit-lead with --commit writes through the real commit path', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'submit-lead',
      '--description',
      'A lead with a citation, committed through the CLI dispatcher.',
      '--url',
      'https://archive.example.org/cli-commit-test',
      '--commit',
      ...BASE_FLAGS,
    ],
    { store, stdout: out.stdout, stderr: out.stderr, nowMs: Date.parse('2026-07-17T04:00:00.000Z') },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
  assert.equal(result.committed, true);
  assert.ok(store.writes.length > 0);
});

test('a missing required flag fails cleanly with a non-zero exit code and no writes', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(['submit-lead', ...BASE_FLAGS], {
    store,
    stdout: out.stdout,
    stderr: out.stderr,
  });
  assert.equal(code, 1);
  assert.match(out.errors[0] ?? '', /--description/);
  assert.equal(store.writes.length, 0);
});

test('research-intake fetches through an injected transport, then opens a draft case', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const encoder = new TextEncoder();
  async function* body() {
    yield encoder.encode('The Douglass Avenue office opened in 1962 as a mutual-aid hub.');
  }
  const code = await runCli(
    ['research-intake', '--url', 'https://archive.example.org/research-intake-test', ...BASE_FLAGS],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
      fetchDependencies: {
        resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
        transport: async () => ({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          remoteAddress: '93.184.216.34',
          body: body(),
        }),
      },
    },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.fetch.ok, true);
  assert.ok(result.citation);
  assert.equal(result.capturePlan.waybackIntegration, 'not_wired');
  assert.equal(result.intake.accepted, true);
});

test('bulk-import reads the injected file and reports a per-row summary', async () => {
  const out = capture();
  const csv = [
    'description,url',
    '"A valid CLI bulk-import lead with a citation.",https://archive.example.org/bulk-a',
  ].join('\n');
  const code = await runCli(['bulk-import', '--file', 'leads.csv', ...BASE_FLAGS], {
    stdout: out.stdout,
    stderr: out.stderr,
    readFile: () => csv,
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
  });
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.total, 1);
  assert.equal(result.acceptedCount, 1);
});

test('an unknown command prints usage and exits non-zero', async () => {
  const out = capture();
  const code = await runCli(['publish-release'], { stdout: out.stdout, stderr: out.stderr });
  assert.equal(code, 1);
  assert.match(out.errors[0] ?? '', /Usage/);
});

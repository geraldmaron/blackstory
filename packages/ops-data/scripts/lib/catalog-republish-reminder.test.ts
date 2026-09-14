import assert from 'node:assert/strict';
import test from 'node:test';
import { remindToRepublishCatalogArtifacts } from './catalog-republish-reminder.ts';

function captureConsoleLog(fn: () => void): readonly string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test('remindToRepublishCatalogArtifacts prints the local republish command when rows changed', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(42));
  assert.ok(
    lines.some((line) => line.includes('publish-release-catalog-artifacts.ts')),
    'prints the local script',
  );
  assert.ok(lines.some((line) => line.includes('STALE')));
});

test('remindToRepublishCatalogArtifacts does not ask for a workflow dispatch', () => {
  // The workflow runs this same script against the same watermark, so a dispatch after a local
  // publish spends CI minutes to reach "up to date — skipping".
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(42));
  assert.ok(
    !lines.some((line) => line.includes('gh workflow run')),
    'never prints a gh workflow run command',
  );
});

test('remindToRepublishCatalogArtifacts prints nothing when nothing changed', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(0));
  assert.deepEqual(lines, []);
});

test('remindToRepublishCatalogArtifacts prints nothing for a negative count (defensive)', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(-1));
  assert.deepEqual(lines, []);
});

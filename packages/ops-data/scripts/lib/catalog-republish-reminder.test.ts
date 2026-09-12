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

test('remindToRepublishCatalogArtifacts prints the workflow-dispatch command when rows changed', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(42));
  assert.ok(
    lines.some((line) => line.includes('gh workflow run publish-release-catalog-artifacts.yml')),
  );
  assert.ok(lines.some((line) => line.includes('STALE')));
});

test('remindToRepublishCatalogArtifacts prints nothing when nothing changed', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(0));
  assert.deepEqual(lines, []);
});

test('remindToRepublishCatalogArtifacts prints nothing for a negative count (defensive)', () => {
  const lines = captureConsoleLog(() => remindToRepublishCatalogArtifacts(-1));
  assert.deepEqual(lines, []);
});

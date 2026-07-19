/**
 * Smoke tests for mock editorial judge + pending list loader (no network).
 */
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runEditorialJudge } from './editorial-run.ts';
import { loadPendingEditorialItems } from './pending-list.ts';
import { createMockLlmProvider } from './llm-provider.ts';
import { prepareEditorialPacketIntake } from './editorial-intake.ts';

test('mock editorial-run keeps a subject and validates linked summary path', async () => {
  const result = await runEditorialJudge({
    subjects: [
      {
        subjectId: 'ent_storme_delarverie_001',
        title: 'Stormé DeLarverie',
        existingSummary: 'Short note.',
      },
    ],
    catalog: [
      { id: 'ent_storme_delarverie_001', displayName: 'Stormé DeLarverie' },
      { id: 'ent_stonewall_inn_001', displayName: 'Stonewall Inn' },
    ],
    identity: {
      operatorId: 'operator-1',
      sessionId: 'session-1',
      source: 'cursor_session',
    },
    nowIso: '2026-07-18T00:00:00.000Z',
    provider: createMockLlmProvider(),
  });
  assert.equal(result.kind, 'editorial.run.v1');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.packet.decision, 'keep');
  assert.ok((result.items[0]?.packet.drafts.publicSummary?.length ?? 0) >= 40);
});

test('pending-list reads obscurity rankedTop JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'editorial-pending-'));
  const path = join(dir, 'obscurity.json');
  writeFileSync(
    path,
    JSON.stringify({
      rankedTop: [{ title: 'DAY 5 — Stormé DeLarverie', score: 0.8, band: 'highly_obscure' }],
    }),
  );
  const pending = loadPendingEditorialItems([path]);
  assert.equal(pending.count, 1);
  assert.match(pending.items[0]?.title ?? '', /Stormé/);
});

test('prepareEditorialPacketIntake stages contribution without publish fields', () => {
  const outcome = prepareEditorialPacketIntake(
    {
      kind: 'editorial.packet.v1',
      subjectId: 'ent_x',
      subjectTitle: 'Example',
      decision: 'keep',
      rationale: 'ok',
      confidence: 0.6,
      drafts: { publicSummary: 'A'.repeat(130) },
      proseLinks: [],
      validationIssues: [],
      createdAt: '2026-07-18T00:00:00.000Z',
    },
    {
      identity: { operatorId: 'op', sessionId: 'sess', source: 'cli' },
      privacyPepper: 'test-only-pepper',
      nowMs: Date.parse('2026-07-18T00:00:00.000Z'),
    },
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  assert.equal(outcome.proposalKind, 'editorial_packet');
  assert.equal(Object.hasOwn(outcome, 'approved'), false);
});

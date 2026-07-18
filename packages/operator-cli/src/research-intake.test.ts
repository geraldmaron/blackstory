
/**
 * Verifies the research-intake composition: fetch -> citation prefill -> capture plan -> draft
 * case, using an injected fake `SafeFetchDependencies` (no real network access, no external
 * DNS) — the real fetch state machine (`executeSafeFetch`) still runs underneath it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  PinnedTransport,
  PinnedTransportResponse,
  ResolveHost,
  SafeFetchDependencies,
} from '@repo/security';
import { runResearchIntake } from './research-intake.ts';
import type { OperatorIntakeContext } from './intake.ts';

const PUBLIC_ADDRESS = '93.184.216.34';
const encoder = new TextEncoder();

async function* chunks(...values: readonly string[]): AsyncGenerator<Uint8Array> {
  for (const value of values) yield encoder.encode(value);
}

function fakeDependencies(overrides: Partial<PinnedTransportResponse> = {}): SafeFetchDependencies {
  const resolveHost: ResolveHost = async () => [{ address: PUBLIC_ADDRESS, family: 4 }];
  const transport: PinnedTransport = async () => ({
    status: 200,
    headers: { 'content-type': 'text/plain' },
    remoteAddress: PUBLIC_ADDRESS,
    body: chunks(
      'The Douglass Avenue mutual-aid office opened in 1962. It served as a community hub.',
    ),
    ...overrides,
  });
  return { resolveHost, transport };
}

function context(): OperatorIntakeContext {
  return {
    identity: { operatorId: 'operator-1', sessionId: 'session-1', source: 'claude_session' },
    privacyPepper: 'test-only-pepper',
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
  };
}

test('a successful fetch pre-fills citation metadata, plans capture, and opens a draft case', async () => {
  const outcome = await runResearchIntake(
    { url: 'https://archive.example.org/douglass-ave' },
    context(),
    fakeDependencies(),
  );
  assert.equal(outcome.fetch.ok, true);
  assert.ok(outcome.citation);
  assert.equal(outcome.citation?.sourceUrl, 'https://archive.example.org/douglass-ave');
  assert.ok(outcome.capturePlan);
  assert.equal(outcome.capturePlan?.waybackIntegration, 'not_wired');
  assert.ok(outcome.intake?.accepted);
  if (outcome.intake?.accepted) {
    assert.ok(outcome.intake.researchCase, 'research-intake opens a draft research case');
  }
});

test('an explicit description overrides the fetched excerpt, but the citation is still attached', async () => {
  const outcome = await runResearchIntake(
    {
      url: 'https://archive.example.org/douglass-ave',
      description: 'Owner note: this plaque names the founders explicitly.',
    },
    context(),
    fakeDependencies(),
  );
  assert.ok(outcome.intake?.accepted);
  if (outcome.intake?.accepted) {
    assert.ok(outcome.intake.submission.normalized.statement.includes('founders explicitly'));
  }
});

test('a denied fetch never reaches intake — nothing is proposed', async () => {
  const denyingResolver: ResolveHost = async () => [{ address: '127.0.0.1', family: 4 }];
  const outcome = await runResearchIntake(
    { url: 'https://archive.example.org/blocked' },
    context(),
    { resolveHost: denyingResolver, transport: async () => {
      throw new Error('transport must never be called for a denied destination');
    } },
  );
  assert.equal(outcome.fetch.ok, false);
  assert.equal(outcome.intake, undefined);
  assert.equal(outcome.citation, undefined);
});

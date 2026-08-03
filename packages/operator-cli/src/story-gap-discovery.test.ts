/**
 * Tests for Story-Specific Discovery: story-worthiness scoring, selection
 * filtering, and the discovery → score → select → directive-loop orchestrator.
 * Inline fixtures only; no network I/O (the loop gather is injected).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DiscoveryCandidateRecord, GeographicHint, ObscurityAssessment } from '@repo/domain';
import {
  buildStoryBriefSubject,
  candidateMatchesGeography,
  candidateMatchesTheme,
  lifeEventCount,
  narrativePotentialRaw,
  runStoryGapDiscovery,
  scoreStoryWorthiness,
  selectStoryCandidates,
  temporalDepthYears,
  type StoryCandidateInput,
} from './story-gap-discovery.ts';
import { createTargetedBriefHandlers } from './research-directive.ts';

const NOW = '2026-07-24T00:00:00.000Z';

type CandidateOverrides = {
  readonly id?: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly geographicHints?: readonly GeographicHint[];
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly matchedTerms?: readonly string[];
};

function makeCandidate(overrides: CandidateOverrides = {}): DiscoveryCandidateRecord {
  const id = overrides.id ?? 'cand-1';
  return {
    schemaVersion: 'discovery-candidate.v1',
    id,
    identity: {
      identityKey: `key-${id}`,
      stableIdentifier: `stable-${id}`,
      contentHash: { algorithm: 'sha256', digest: 'deadbeef' },
      sourceReferences: [],
    },
    adapterRecord: {
      stableIdentifier: `stable-${id}`,
      title: overrides.title ?? 'A Local Life',
      ...(overrides.canonicalUrl ? { canonicalUrl: overrides.canonicalUrl } : {}),
      payload: overrides.payload ?? {},
      provenance: {
        sourceId: 'src-1',
        adapterId: 'adapter-1',
        parserVersion: 'v1',
        registryEntryId: 'reg-1',
        runId: 'run-1',
        capturedAt: NOW,
        schemaVersion: 'adapter-candidate.v1',
      },
    },
    status: 'pending',
    ingestMode: 'bulk',
    signals: {
      strength: 'medium',
      outcome: 'candidate_only',
      matchedClasses: [],
      matchedTerms: overrides.matchedTerms ?? [],
      reasons: [],
    },
    geographicHints: overrides.geographicHints ?? [],
    retryCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeObscurity(
  candidateId: string,
  score: number,
  band: ObscurityAssessment['band'],
): ObscurityAssessment {
  return {
    methodologyVersion: 'obscurity.v1',
    candidateId,
    score,
    band,
    factors: [],
    disclaimerId: 'methodology_obscurity_heuristic_v1',
    assessedAt: NOW,
  };
}

const cityHint: GeographicHint = { text: 'Bronzeville, Chicago', kind: 'city', confidence: 0.9 };
const stateHint: GeographicHint = { text: 'Illinois', kind: 'state', confidence: 0.6 };

const richPayload = {
  summary: 'A schoolteacher and civic organizer in the redlining-era South Side.',
  placeLabel: 'Bronzeville, Chicago',
  lifeEvents: [
    { label: 'born', year: 1901 },
    { label: 'founded mutual aid society', year: 1932 },
    { label: 'testified before housing board', year: 1948 },
  ],
} as const;

test('lifeEventCount and temporalDepthYears read payload life events', () => {
  const candidate = makeCandidate({ payload: richPayload });
  assert.equal(lifeEventCount(candidate), 3);
  const depth = temporalDepthYears(candidate);
  assert.equal(depth.hasTemporal, true);
  assert.equal(depth.spanYears, 47);
});

test('narrativePotentialRaw rewards events + temporal depth + specific place', () => {
  const rich = narrativePotentialRaw(
    makeCandidate({ payload: richPayload, geographicHints: [cityHint] }),
  );
  const thin = narrativePotentialRaw(
    makeCandidate({ payload: { summary: 'A name in a list.' }, geographicHints: [] }),
  );
  assert.ok(rich.raw > thin.raw);
  assert.equal(thin.raw, 0);
});

test('scoreStoryWorthiness: obscure + city beats common + state', () => {
  const obscureCity = scoreStoryWorthiness(
    makeCandidate({ id: 'a', payload: richPayload, geographicHints: [cityHint] }),
    makeObscurity('a', 0.78, 'highly_obscure'),
  );
  const commonState = scoreStoryWorthiness(
    makeCandidate({
      id: 'b',
      payload: { summary: 'Widely covered figure.', lifeEvents: [{ label: 'born', year: 1900 }] },
      geographicHints: [stateHint],
    }),
    makeObscurity('b', 0.2, 'common'),
  );

  assert.ok(obscureCity.score > commonState.score);
  assert.equal(obscureCity.storyWorthy, true);
  assert.equal(commonState.storyWorthy, false);
  assert.equal(obscureCity.band, 'strong_story');
});

test('scoreStoryWorthiness gates: each missing condition blocks story-worthiness', () => {
  // Obscure + city but only one life event → multipleLifeEvents gate fails.
  const oneEvent = scoreStoryWorthiness(
    makeCandidate({
      id: 'c',
      payload: { lifeEvents: [{ label: 'born', year: 1910 }] },
      geographicHints: [cityHint],
    }),
    makeObscurity('c', 0.6, 'obscure'),
  );
  assert.equal(oneEvent.gates.multipleLifeEvents, false);
  assert.equal(oneEvent.storyWorthy, false);

  // Obscure + multiple events but only state hint → geographic gate fails.
  const stateOnly = scoreStoryWorthiness(
    makeCandidate({ id: 'd', payload: richPayload, geographicHints: [stateHint] }),
    makeObscurity('d', 0.6, 'obscure'),
  );
  assert.equal(stateOnly.gates.geographicallySpecific, false);
  assert.equal(stateOnly.storyWorthy, false);

  // City + multiple events but notable band → obscure gate fails.
  const notable = scoreStoryWorthiness(
    makeCandidate({ id: 'e', payload: richPayload, geographicHints: [cityHint] }),
    makeObscurity('e', 0.4, 'notable'),
  );
  assert.equal(notable.gates.obscure, false);
  assert.equal(notable.storyWorthy, false);
});

test('candidateMatchesTheme / candidateMatchesGeography', () => {
  const candidate = makeCandidate({
    title: 'Bronzeville housing organizer',
    payload: { themes: ['redlining'], placeLabel: 'Bronzeville, Chicago' },
    geographicHints: [cityHint],
  });
  assert.equal(candidateMatchesTheme(candidate, 'redlining'), true);
  assert.equal(candidateMatchesTheme(candidate, 'voting_rights'), false);
  assert.equal(candidateMatchesGeography(candidate, 'Chicago'), true);
  assert.equal(candidateMatchesGeography(candidate, 'Atlanta'), false);
  assert.equal(candidateMatchesGeography(candidate, ''), true);
});

test('selectStoryCandidates filters to story-worthy, theme, and geography', () => {
  const inputs: StoryCandidateInput[] = [
    {
      candidate: makeCandidate({
        id: 'worthy',
        title: 'Bronzeville schoolteacher',
        payload: { ...richPayload, themes: ['redlining'] },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('worthy', 0.75, 'highly_obscure'),
    },
    {
      // Story-worthy but wrong theme (no redlining terms anywhere).
      candidate: makeCandidate({
        id: 'wrong-theme',
        title: 'Bronzeville church choir director',
        payload: {
          summary: 'A choir director and music teacher in the neighborhood.',
          placeLabel: 'Bronzeville, Chicago',
          themes: ['voting_rights'],
          lifeEvents: richPayload.lifeEvents,
        },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('wrong-theme', 0.75, 'highly_obscure'),
    },
    {
      // Story-worthy, right theme, wrong geography.
      candidate: makeCandidate({
        id: 'wrong-geo',
        title: 'Harlem organizer',
        payload: {
          themes: ['redlining'],
          placeLabel: 'Harlem, New York',
          lifeEvents: richPayload.lifeEvents,
        },
        geographicHints: [{ text: 'Harlem, New York', kind: 'city', confidence: 0.9 }],
      }),
      obscurity: makeObscurity('wrong-geo', 0.75, 'highly_obscure'),
    },
    {
      // Common band → not story-worthy.
      candidate: makeCandidate({
        id: 'common',
        payload: { ...richPayload, themes: ['redlining'] },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('common', 0.2, 'common'),
    },
  ];

  const result = selectStoryCandidates(inputs, 'redlining', 'Chicago');
  assert.equal(result.consideredCount, 4);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0]?.candidate.id, 'worthy');
  assert.equal(result.rejectedCount, 3);
  assert.match(result.selected[0]!.subject.briefId, /^story-redlining-worthy$/u);
});

test('buildStoryBriefSubject carries place, seed url, and theme query', () => {
  const subject = buildStoryBriefSubject(
    makeCandidate({
      id: 'x',
      title: 'Bronzeville organizer',
      canonicalUrl: 'https://archive.example.org/bronzeville/x',
      payload: { placeLabel: 'Bronzeville, Chicago' },
      geographicHints: [cityHint],
    }),
    'redlining',
    'Chicago',
  );
  assert.equal(subject.placeLabel, 'Bronzeville, Chicago');
  assert.deepEqual(subject.seedUrls, ['https://archive.example.org/bronzeville/x']);
  assert.match(subject.searchQueries?.[0] ?? '', /redlining/u);
});

test('runStoryGapDiscovery selects and routes through the shared directive loop', async () => {
  const inputs: StoryCandidateInput[] = [
    {
      candidate: makeCandidate({
        id: 'worthy',
        title: 'Bronzeville schoolteacher',
        canonicalUrl: 'https://archive.example.org/bronzeville/worthy',
        payload: { ...richPayload, themes: ['redlining'] },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('worthy', 0.75, 'highly_obscure'),
    },
    {
      candidate: makeCandidate({
        id: 'common',
        payload: { ...richPayload, themes: ['redlining'] },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('common', 0.2, 'common'),
    },
  ];

  // Inject a fixture gather so no network I/O occurs; still exercises the
  // real createTargetedBriefHandlers extract/decide logic.
  const handlers = {
    ...createTargetedBriefHandlers(),
    gather: async () => ({
      sources: [
        {
          url: 'https://archive.example.org/bronzeville/worthy',
          text: 'Documented Bronzeville schoolteacher and organizer with archived records.',
          excerpt: 'Documented Bronzeville schoolteacher and organizer with archived records.',
          fetched: false as const,
        },
      ],
      formattedSnippets: ['Source: worthy\nDocumented Bronzeville schoolteacher.'],
      attemptedUrlCount: 1,
      fetchedUrlCount: 0,
    }),
  };

  const result = await runStoryGapDiscovery({
    theme: 'redlining',
    geography: 'Chicago',
    candidates: inputs,
    nowIso: NOW,
    directiveHandlers: handlers,
  });

  assert.equal(result.kind, 'story.gap.discovery.v1');
  assert.equal(result.consideredCount, 2);
  assert.equal(result.selectedCount, 1);
  assert.equal(result.briefedCount, 1);
  assert.equal(result.briefs[0]?.candidateId, 'worthy');
  assert.equal(result.briefs[0]?.decision.action, 'stage_for_review');
  assert.equal(result.briefs[0]?.run.plan.kind, 'targeted_brief');
});

test('runStoryGapDiscovery respects maxBriefs and never publishes (hold on no sources)', async () => {
  const inputs: StoryCandidateInput[] = [
    {
      candidate: makeCandidate({
        id: 'worthy',
        payload: { ...richPayload, themes: ['redlining'] },
        geographicHints: [cityHint],
      }),
      obscurity: makeObscurity('worthy', 0.75, 'highly_obscure'),
    },
  ];

  // Handlers with an empty gather → decide can only hold, never publish.
  const handlers = {
    ...createTargetedBriefHandlers(),
    gather: async () => ({
      sources: [],
      formattedSnippets: [],
      attemptedUrlCount: 0,
      fetchedUrlCount: 0,
    }),
  };

  const result = await runStoryGapDiscovery({
    theme: 'redlining',
    geography: 'Chicago',
    candidates: inputs,
    nowIso: NOW,
    maxBriefs: 0,
    directiveHandlers: handlers,
  });
  assert.equal(result.selectedCount, 1);
  assert.equal(result.briefedCount, 0);

  const routed = await runStoryGapDiscovery({
    theme: 'redlining',
    geography: 'Chicago',
    candidates: inputs,
    nowIso: NOW,
    directiveHandlers: handlers,
  });
  assert.equal(routed.briefs[0]?.decision.action, 'hold');
});

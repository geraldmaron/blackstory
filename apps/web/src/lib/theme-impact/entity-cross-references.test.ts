/**
 * Tests for `resolveEntityCrossReferences`: entities as connective tissue between
 * entity pages and theme-impact packets. With the legacy story/theme surfaces retired
 * (repo-dx4n / repo-8dj0), packets bound via `entityBinding.entityId` are the only
 * cross-reference surface. Uses test-only `deps` injection so this suite runs offline.
 * Covers an entity with zero, one, and multiple cross-references, and asserts every
 * resolved href/label pair is a real, non-dead target.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entityCrossReferenceHref,
  entityCrossReferenceLabel,
  resolveEntityCrossReferences,
} from './source.js';

function packetView(themeId: string, questionId: string, entityId: string | undefined) {
  return {
    packetId: `tip_${questionId}`,
    questionId,
    themeId,
    question: `Question ${questionId}`,
    policyEras: [],
    geography: { unit: 'county', label: 'Baltimore city, MD' },
    methodStance: 'juxtaposition',
    methodNote: 'Fixture method note.',
    observationsSummary: 'Fixture summary.',
    observations: [],
    derived: [],
    artifacts: [],
    gapStates: [],
    ...(entityId ? { entityBinding: { entityId, purpose: 'story' } } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function stubbedPacketDeps(packetsByTheme: Record<string, readonly unknown[]>) {
  return {
    listPackets: async (themeId: string) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      packets: (packetsByTheme[themeId] ?? []) as any,
      source: 'live' as const,
    }),
    themeIds: Object.keys(packetsByTheme),
    getThemeTitle: (themeId: string) =>
      ({ redlining: 'Housing segregation & redlining', urban_renewal: 'Urban renewal' })[themeId],
  };
}

test('resolveEntityCrossReferences returns nothing for an entity with zero cross-references', async () => {
  const surfaces = await resolveEntityCrossReferences('ent_nobody', stubbedPacketDeps({}));
  assert.deepEqual(surfaces, []);
});

test('resolveEntityCrossReferences resolves a single bound packet', async () => {
  const surfaces = await resolveEntityCrossReferences(
    'ent_solo',
    stubbedPacketDeps({
      redlining: [
        packetView('redlining', 'Q1', 'ent_solo'),
        packetView('redlining', 'Q2', undefined),
      ],
      urban_renewal: [],
    }),
  );
  assert.equal(surfaces.length, 1);
  const [surface] = surfaces;
  assert.ok(surface);
  assert.equal(surface.kind, 'theme_packet');
  // redlining has an authored chapter, so the href targets it directly.
  assert.equal(entityCrossReferenceHref(surface), '/stories/buying-a-home');
  assert.equal(entityCrossReferenceLabel(surface), 'Housing segregation & redlining: Question Q1');
});

test('resolveEntityCrossReferences resolves bound packets across multiple themes', async () => {
  const surfaces = await resolveEntityCrossReferences(
    'ent_shared',
    stubbedPacketDeps({
      redlining: [packetView('redlining', 'Q1', 'ent_shared')],
      urban_renewal: [packetView('urban_renewal', 'Q4', 'ent_shared')],
    }),
  );

  assert.equal(surfaces.length, 2);
  for (const surface of surfaces) {
    assert.equal(surface.kind, 'theme_packet');
    assert.match(entityCrossReferenceHref(surface), /^\/stories/);
    assert.ok(entityCrossReferenceLabel(surface).length > 0);
  }
  // urban_renewal has no authored chapter yet, so its href falls back to the index.
  const urbanRenewal = surfaces.find((surface) => surface.themeId === 'urban_renewal');
  assert.ok(urbanRenewal);
  assert.equal(entityCrossReferenceHref(urbanRenewal), '/stories');
});

test('resolveEntityCrossReferences skips themes with no catalog title', async () => {
  const deps = stubbedPacketDeps({});
  const surfaces = await resolveEntityCrossReferences('ent_shared', {
    ...deps,
    themeIds: ['unknown_theme'],
    listPackets: async () => {
      throw new Error('listPackets must not be called for a theme without a catalog title');
    },
  });
  assert.deepEqual(surfaces, []);
});

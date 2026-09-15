import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_SNAPSHOT_VERSION,
  buildLivesAreaBundle,
  livesAreaBySlug,
  type LivesAreaSnapshot,
} from '@repo/domain/statistics/lives';
import { emptyLivesAreaBundle, linkLivesRules } from './lives-source';

const area = livesAreaBySlug('upper-south')!;

function rule(id: string, entityId: string, name: string) {
  return {
    id,
    entityId,
    entityName: name,
    entityHref: `/entity/${entityId}`,
    jurisdictionId: 'nation:US',
    scopeLevel: 'federal' as const,
    inForceFromYear: 1954,
    inForceToYear: null,
    groupsNamed: [],
    appliesToSlices: ['all' as const],
    lifeDomains: ['schooling'],
    textPosture: 'protective' as const,
    disputed: false,
    summary: null,
  };
}

const snapshot: LivesAreaSnapshot = {
  version: LIVES_SNAPSHOT_VERSION,
  areaSlug: area.slug,
  generatedAt: '2026-09-15T00:00:00.000Z',
  contentHash: 'hash',
  bundle: buildLivesAreaBundle({
    area,
    jurisdictions: [],
    observations: [],
    coverage: [],
    countNotes: [],
    applicability: [
      rule('brown', 'ent_brown', 'Brown v. Board'),
      rule('other', 'ent_other', 'Other'),
    ],
    frames: [],
  }),
  ruleEntities: {
    ent_brown: { kind: 'case', displayName: 'Brown v. Board' },
    ent_other: { kind: 'law', displayName: 'Other' },
  },
};

test('rules link to their law page when one resolves and keep the record link otherwise', async () => {
  const bundle = await linkLivesRules(snapshot, async (entity) =>
    entity.kind === 'case' ? '/law/brown-v-board' : undefined,
  );
  const rules = bundle.decades.find((decade) => decade.decade === 1960)!.rulesInForce;
  assert.equal(rules.find((r) => r.entityId === 'ent_brown')!.href, '/law/brown-v-board');
  assert.equal(rules.find((r) => r.entityId === 'ent_other')!.href, '/entity/ent_other');
});

test('nothing resolving returns the snapshot bundle unchanged', async () => {
  assert.equal(await linkLivesRules(snapshot, async () => undefined), snapshot.bundle);
});

test('an area without a snapshot still renders every decade as not yet counted', () => {
  const bundle = emptyLivesAreaBundle(area);
  assert.equal(bundle.decades.length, 16);
  assert.equal(bundle.decades[0]!.conditions[0]!.cells.black.state, 'pending');
});

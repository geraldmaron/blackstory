/**
 * Unit tests for the canonical claims backfill planner: source resolution must reuse the existing
 * evidence library instead of fragmenting it, and blocked entities must contribute no rows.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBackfillPlan,
  hostSuffixes,
  normalizeHost,
  resolveMergedOrganization,
  stableId,
  type PlanSnapshot,
  type SnapshotEntity,
} from './canonical-claims-backfill-plan.ts';

const empty = new Set<string>();

function claim(id: string, href: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    predicate: 'documented_site',
    object: `object for ${id}`,
    claimRole: 'evidence',
    citationHref: href,
    citationLabel: `label ${id}`,
    citationSource: 'Some Source',
    confidenceLevel: 'medium',
    ...extra,
  };
}

function entity(entityId: string, claims: unknown, overrides: Partial<SnapshotEntity> = {}) {
  return {
    entityId,
    kind: 'place',
    researchCoverage: 'partial',
    canonicalEntityExists: true,
    claims,
    ...overrides,
  };
}

function snapshot(overrides: Partial<PlanSnapshot>): PlanSnapshot {
  return {
    releaseId: 'rel_test',
    entities: [],
    domains: [],
    organizations: [],
    sources: [],
    items: [],
    evidence: [],
    existingClaimIds: empty,
    existingGeneratedIds: {
      organizations: empty,
      domains: empty,
      sources: empty,
      items: empty,
      evidence: empty,
      claimVersions: empty,
      links: empty,
    },
    ...overrides,
  };
}

test('stableId matches ids written by canonical-convergence', () => {
  // org_web_903b5539... is the live row canonical-convergence wrote for this hostname.
  assert.equal(
    stableId('org_web', 'thewestsidegazette.com'),
    'org_web_903b5539a614cc35bc8e09f7d93e5019',
  );
});

test('normalizeHost lowercases, strips www, and rejects non-http URLs', () => {
  assert.equal(normalizeHost('https://WWW.NPS.gov/places/x.htm'), 'nps.gov');
  assert.equal(normalizeHost('http://archives.barnard.edu/a'), 'archives.barnard.edu');
  assert.equal(normalizeHost('ftp://example.org/file'), null);
  assert.equal(normalizeHost('not a url'), null);
  assert.deepEqual(hostSuffixes('a.b.org'), ['a.b.org', 'b.org', 'org']);
});

test('resolveMergedOrganization follows chains and refuses cycles', () => {
  const merged = new Map<string, string | null>([
    ['a', 'b'],
    ['b', 'c'],
    ['c', null],
  ]);
  assert.equal(resolveMergedOrganization('a', merged), 'c');
  assert.throws(() =>
    resolveMergedOrganization(
      'x',
      new Map([
        ['x', 'y'],
        ['y', 'x'],
      ]),
    ),
  );
});

test('longest suffix match picks the most specific domain and its fullest source', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [
        entity('ent_1', [
          claim('claim_a', 'https://archives.lib.x.edu/1'),
          claim('claim_b', 'https://www.news.x.edu/2'),
        ]),
      ],
      organizations: [
        { id: 'org_x', mergedIntoOrganizationId: null },
        { id: 'org_lib', mergedIntoOrganizationId: null },
      ],
      domains: [
        { id: 'dom_x', organizationId: 'org_x', hostname: 'www.x.edu' },
        { id: 'dom_lib', organizationId: 'org_lib', hostname: 'lib.x.edu' },
      ],
      sources: [
        { id: 'src_x_small', organizationId: 'org_x', itemCount: 1 },
        { id: 'src_x_big', organizationId: 'org_x', itemCount: 40 },
        { id: 'src_lib', organizationId: 'org_lib', itemCount: 3 },
      ],
    }),
  );
  const [entityPlan] = plan.entities;
  assert.deepEqual(entityPlan!.blocked, []);
  const byClaim = new Map(entityPlan!.resolutions.map((r) => [r.claimId, r]));
  assert.equal(byClaim.get('claim_a')!.organizationId, 'org_lib');
  assert.equal(byClaim.get('claim_a')!.sourceId, 'src_lib');
  assert.equal(byClaim.get('claim_b')!.organizationId, 'org_x');
  assert.equal(byClaim.get('claim_b')!.sourceId, 'src_x_big');
  assert.equal(plan.totals.organizationsNew, 0);
  assert.equal(plan.totals.evidenceSourcesNew, 0);
  assert.equal(plan.totals.sourceItemsNew, 2);
  assert.equal(plan.totals.evidenceRecordsNew, 2);
  assert.equal(plan.totals.claims, 2);
  assert.equal(plan.totals.links, 2);
  // Public claim id is reused as the canonical id, and the version is current.
  const claimRow = entityPlan!.claims.find((row) => row.id === 'claim_a')!;
  const versionRow = entityPlan!.claimVersions.find((row) => row.claim_id === 'claim_a')!;
  assert.equal(claimRow.current_version_id, versionRow.id);
  assert.equal(claimRow.publication_status, 'published');
});

test('merged organizations resolve to the survivor', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [entity('ent_1', [claim('claim_a', 'https://old.org/page')])],
      organizations: [
        { id: 'org_old', mergedIntoOrganizationId: 'org_new' },
        { id: 'org_new', mergedIntoOrganizationId: null },
      ],
      domains: [{ id: 'dom_old', organizationId: 'org_old', hostname: 'old.org' }],
      sources: [
        { id: 'src_old', organizationId: 'org_old', itemCount: 2 },
        { id: 'src_new', organizationId: 'org_new', itemCount: 9 },
      ],
    }),
  );
  const resolution = plan.entities[0]!.resolutions[0]!;
  assert.equal(resolution.organizationId, 'org_new');
  assert.equal(resolution.organizationResolution, 'matched_via_merge');
  assert.equal(resolution.sourceId, 'src_new');
  assert.equal(plan.totals.claimsResolvedViaMerge, 1);
});

test('existing source items and excerpt-free evidence are reused', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [
        entity('ent_1', [
          claim('claim_same', 'https://x.org/same'),
          claim('claim_url', 'https://x.org/elsewhere'),
        ]),
      ],
      organizations: [{ id: 'org_x', mergedIntoOrganizationId: null }],
      domains: [{ id: 'dom_x', organizationId: 'org_x', hostname: 'x.org' }],
      sources: [
        { id: 'src_x', organizationId: 'org_x', itemCount: 5 },
        { id: 'src_orphan', organizationId: null, itemCount: 1 },
      ],
      items: [
        { id: 'item_same', sourceId: 'src_x', stableIdentifier: 'https://x.org/same', url: null },
        {
          id: 'item_orphan',
          sourceId: 'src_orphan',
          stableIdentifier: 'orphan-key',
          url: 'https://x.org/elsewhere',
        },
      ],
      evidence: [
        { id: 'ev_with_excerpt', sourceItemId: 'item_same', excerpt: 'about another fact' },
        { id: 'ev_plain', sourceItemId: 'item_orphan', excerpt: null },
      ],
    }),
  );
  const byClaim = new Map(plan.entities[0]!.resolutions.map((r) => [r.claimId, r]));
  assert.equal(byClaim.get('claim_same')!.sourceItemId, 'item_same');
  assert.equal(byClaim.get('claim_same')!.sourceItemResolution, 'reused_same_source');
  // The only record on item_same carries an excerpt, so a fresh citation record is minted.
  assert.equal(byClaim.get('claim_same')!.evidenceResolution, 'new');
  assert.equal(byClaim.get('claim_same')!.evidenceId, stableId('ev_web', 'item_same'));
  assert.equal(byClaim.get('claim_url')!.sourceItemId, 'item_orphan');
  assert.equal(byClaim.get('claim_url')!.sourceItemResolution, 'reused_by_url');
  assert.equal(byClaim.get('claim_url')!.evidenceId, 'ev_plain');
  assert.equal(plan.totals.sourceItemsNew, 0);
  assert.equal(plan.totals.sourceItemsReused, 2);
  assert.equal(plan.totals.evidenceRecordsReused, 1);
  assert.equal(plan.totals.evidenceRecordsNew, 1);
});

test('unmatched hosts mint one organization, shortest host first', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [
        entity('ent_1', [claim('claim_a', 'https://archives.barnard.edu/a')]),
        entity('ent_2', [
          claim('claim_b', 'https://www.barnard.edu/b'),
          claim('claim_c', 'https://barnard.edu/c'),
        ]),
      ],
    }),
  );
  assert.equal(plan.totals.organizationsNew, 1);
  assert.equal(plan.totals.domainsNew, 1);
  assert.equal(plan.totals.evidenceSourcesNew, 1);
  assert.equal(plan.totals.hostsUnmatched, 1);
  assert.deepEqual(plan.unmatchedHosts, ['barnard.edu']);
  assert.equal(plan.organizations[0]!.id, stableId('org_web', 'barnard.edu'));
  assert.equal(plan.domains[0]!.hostname, 'barnard.edu');
  const orgIds = new Set(plan.entities.flatMap((e) => e.resolutions.map((r) => r.organizationId)));
  assert.deepEqual([...orgIds], [stableId('org_web', 'barnard.edu')]);
});

test('ambiguous www-stripped hosts choose the organization with more items', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [entity('ent_1', [claim('claim_a', 'https://nps.gov/x')])],
      organizations: [
        { id: 'org_small', mergedIntoOrganizationId: null },
        { id: 'org_big', mergedIntoOrganizationId: null },
      ],
      domains: [
        { id: 'dom_small', organizationId: 'org_small', hostname: 'nps.gov' },
        { id: 'dom_big', organizationId: 'org_big', hostname: 'www.nps.gov' },
      ],
      sources: [
        { id: 'src_small', organizationId: 'org_small', itemCount: 1 },
        { id: 'src_big', organizationId: 'org_big', itemCount: 150 },
      ],
    }),
  );
  assert.equal(plan.entities[0]!.resolutions[0]!.organizationId, 'org_big');
  assert.equal(plan.totals.hostsAmbiguous, 1);
});

test('blocked entities contribute no claims and no shared rows', () => {
  const plan = buildBackfillPlan(
    snapshot({
      entities: [
        entity('ent_missing', [claim('claim_a', 'https://lonely.org/a')], {
          canonicalEntityExists: false,
        }),
        entity('ent_collide', [claim('claim_taken', 'https://other.org/b')]),
        entity('ent_bad_url', [claim('claim_ftp', 'ftp://files.org/c')]),
        entity('ent_empty', []),
      ],
      existingClaimIds: new Set(['claim_taken']),
    }),
  );
  assert.equal(plan.totals.entitiesBlocked, 4);
  assert.equal(plan.totals.claims, 0);
  assert.equal(plan.organizations.length, 0);
  assert.equal(plan.domains.length, 0);
  assert.equal(plan.evidenceSources.length, 0);
  assert.equal(plan.sourceItems.length, 0);
  assert.equal(plan.evidenceRecords.length, 0);
});

test('an empty scope is a no-op, which is what a re-run after apply sees', () => {
  const plan = buildBackfillPlan(snapshot({}));
  assert.equal(plan.totals.entitiesInScope, 0);
  assert.equal(plan.totals.claims, 0);
  assert.equal(plan.organizations.length, 0);
});

test('planning is deterministic', () => {
  const input = snapshot({
    entities: [entity('ent_1', [claim('claim_a', 'https://z.org/a')])],
  });
  assert.deepEqual(buildBackfillPlan(input), buildBackfillPlan(input));
});

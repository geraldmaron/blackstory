/**
 * Asserts infra/gcp/isolation-matrix.json encodes the ADR-012 (BB-078) cross-project
 * invariants: the productionResplitTarget topology, the exact one-way crossProjectGrants
 * list (internal -> prod only, never the reverse), the two new cross-project service account
 * identities, and the AC-ISO-1..5 restatement for the three-project target. This does not
 * replace docs/security/environment-isolation.md's prose invariants or the JSON Schema check
 * documented in infra/gcp/README.md - it is an additional, narrower assertion focused on the
 * BB-078 delta so a future edit cannot silently drop the asymmetry the ADR depends on.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const matrix = JSON.parse(
  await readFile(new URL('../../../isolation-matrix.json', import.meta.url), 'utf8'),
);

const PROD_PROJECT_ID = 'black-book-efaaf';
const INTERNAL_IDENTITY_SUFFIX = '@blackbook-internal.iam.gserviceaccount.com';

test('productionResplitTarget names the ADR-012 three-project topology', () => {
  const target = matrix.productionResplitTarget;
  assert.ok(target, 'productionResplitTarget must be present');
  assert.equal(target.adr, 'ADR-012');
  assert.equal(target.migrationBead, 'BB-079');
  assert.equal(target.status, 'design-not-applied');

  const projectIds = target.projects.map((p) => p.projectId).sort();
  assert.deepEqual(projectIds, ['black-book-efaaf', 'blackbook-internal', 'blackbook-staging'].sort());

  const prod = target.projects.find((p) => p.projectId === PROD_PROJECT_ID);
  assert.equal(prod.retainedFrom, PROD_PROJECT_ID, 'blackbook-prod must be the retained project, not a fresh one');

  const staging = target.projects.find((p) => p.projectId === 'blackbook-staging');
  const internal = target.projects.find((p) => p.projectId === 'blackbook-internal');
  assert.equal(staging.retainedFrom, null, 'blackbook-staging must be a new project');
  assert.equal(internal.retainedFrom, null, 'blackbook-internal must be a new project');
});

test('mode/currentProject stay accurate to the live single-project state', () => {
  // BB-078 must not overclaim the migration as applied - the live reality is unchanged
  // until BB-079 runs. See docs/security/environment-isolation.md's "Verified live vs.
  // designed" table for the same distinction in prose.
  assert.equal(matrix.mode, 'single-project');
  assert.equal(matrix.currentProject.projectId, PROD_PROJECT_ID);
  assert.equal(matrix.currentProject.live, true);
});

test('crossProjectGrants is exactly the ADR-012 one-way promotion asymmetry', () => {
  const grants = matrix.crossProjectGrants;
  assert.ok(Array.isArray(grants) && grants.length > 0, 'crossProjectGrants must be populated');

  for (const grant of grants) {
    assert.ok(
      grant.from.includes(INTERNAL_IDENTITY_SUFFIX),
      `grant ${grant.id} must originate from a blackbook-internal identity, got: ${grant.from}`,
    );
    assert.ok(
      !grant.to.toLowerCase().includes('blackbook-internal'),
      `grant ${grant.id} must not grant anything into blackbook-internal (zero prod-principal IAM invariant), got: ${grant.to}`,
    );
    assert.ok(grant.rationale.includes('ADR-012'), `grant ${grant.id} rationale must reference ADR-012`);
  }

  const grantIds = grants.map((g) => g.id).sort();
  assert.deepEqual(
    grantIds,
    [
      'promotion-write-prod-buckets',
      'promotion-write-prod-firestore',
      'security-quarantine-prod',
      'submissions-puller-read-prod',
    ].sort(),
  );

  const promotionFirestore = grants.find((g) => g.id === 'promotion-write-prod-firestore');
  assert.ok(promotionFirestore.condition.includes('/public/'), 'promotion write must be scoped to public/** projections');

  const pullerRead = grants.find((g) => g.id === 'submissions-puller-read-prod');
  assert.ok(pullerRead.role.includes('Viewer') || pullerRead.role.includes('viewer'), 'submissions-puller must be read-only');
  assert.ok(pullerRead.condition.includes('/submissions/'), 'puller read must be scoped to the submissions collection');
});

test('promotion and submissions-puller identities exist and stay out of prod-forbidden territory', () => {
  const byId = Object.fromEntries(matrix.serviceAccounts.map((sa) => [sa.id, sa]));

  const promotion = byId.promotion;
  assert.ok(promotion, 'serviceAccounts must include promotion');
  assert.equal(promotion.project, 'blackbook-internal');
  assert.ok(promotion.mustNotHave.some((m) => m.includes('raw-ingest')));

  const puller = byId['submissions-puller'];
  assert.ok(puller, 'serviceAccounts must include submissions-puller');
  assert.equal(puller.project, 'blackbook-internal');
  assert.ok(puller.mustNotHave.some((m) => m.toLowerCase().includes('write')));
});

test('AC-ISO-1..5 are restated for the ADR-012 target topology', () => {
  const ids = ['AC-ISO-1', 'AC-ISO-2', 'AC-ISO-3', 'AC-ISO-4', 'AC-ISO-5'];
  const byId = Object.fromEntries(matrix.acceptanceCriteria.map((ac) => [ac.id, ac]));

  for (const id of ids) {
    const ac = byId[id];
    assert.ok(ac, `${id} must be present`);
    assert.ok(
      ac.enforcedBy.some((bullet) => bullet.includes('[ADR-012 target')),
      `${id}.enforcedBy must include an [ADR-012 target...] restatement bullet`,
    );
  }
});

test('adrRefs includes ADR-012', () => {
  assert.ok(matrix.adrRefs.includes('ADR-012'));
});

test('the four ADR-012-relocated service accounts and private-evidence resolve to blackbook-internal, not blackbook-prod', () => {
  // black-book-2ve (BB-078 course-correction): infra/gcp/terraform/locals.tf and buckets.tf no
  // longer create admin/publication/security/research or the private-evidence bucket in
  // blackbook-prod - they belong to infra/gcp/terraform/multi-project/ instead. This asserts
  // isolation-matrix.json (the source of truth those Terraform files implement) agrees, so a
  // future edit to one side cannot silently drift from the other again.
  const byId = Object.fromEntries(matrix.serviceAccounts.map((sa) => [sa.id, sa]));

  for (const id of ['admin', 'publication', 'security', 'research']) {
    const sa = byId[id];
    assert.ok(sa, `serviceAccounts must include ${id}`);
    assert.equal(sa.project, 'blackbook-internal', `${id} must resolve to blackbook-internal under ADR-012, not ${sa.project}`);
    assert.ok(
      sa.mustNotHave.some((m) => m.toLowerCase().includes('blackbook-prod')) || id === 'security',
      `${id}.mustNotHave should flag the absence of any blackbook-prod grant (security's grant is documented as a legitimate cross-project exception instead)`,
    );
  }

  const buckets = Object.fromEntries(matrix.buckets.map((b) => [b.id, b]));
  const privateEvidence = buckets['private-evidence'];
  assert.ok(privateEvidence, 'buckets must include private-evidence');
  assert.equal(privateEvidence.project, 'blackbook-internal', 'private-evidence must resolve to blackbook-internal under ADR-012');
  assert.equal(privateEvidence.namePattern, 'blackbook-internal-private-evidence');
  assert.ok(
    !privateEvidence.readers.some((r) => r.includes('api-internal')),
    'private-evidence readers must not include api-internal (a blackbook-prod principal) - that would violate the prod -> internal: none invariant',
  );

  // private-evidence is same-project once relocated, so - unlike promotion/security/puller - it
  // legitimately has no crossProjectGrants entry of its own; assert that stays true rather than
  // silently accepting a stray grant that would mean the bucket move was only half-applied.
  assert.ok(
    !matrix.crossProjectGrants.some((g) => g.to.toLowerCase().includes('private-evidence')),
    'private-evidence must not appear in crossProjectGrants - it is same-project in blackbook-internal now, not cross-project',
  );
});

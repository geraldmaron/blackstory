/**
 * Static tests reject invalid curated legal-entity mappings. The loader separately checks every
 * non-null entity id against the active public release.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { listLegalSnapshots } from '../../../../apps/web/src/data/legal-seed.ts';
import {
  CANONICAL_ENTITY_BY_SLUG,
  DEAD_SEED_ENTITY_PREFIX,
  resolveCanonicalEntityId,
} from './legal-snapshot-entity-links.ts';

test('every seed snapshot has been ruled on', () => {
  for (const snapshot of listLegalSnapshots()) {
    assert.doesNotThrow(
      () => resolveCanonicalEntityId(snapshot.slug),
      `${snapshot.slug} has no entry — rule on it (an id, or null with its reason) before loading`,
    );
  }
});

test('an unruled slug throws rather than loading unlinked', () => {
  assert.throws(
    () => resolveCanonicalEntityId('a-snapshot-nobody-mapped'),
    /has no entry in CANONICAL_ENTITY_BY_SLUG/u,
  );
});

test('no mapping points at the retired ent_seed_ namespace', () => {
  for (const [slug, entityId] of Object.entries(CANONICAL_ENTITY_BY_SLUG)) {
    if (entityId === null) continue;
    assert.equal(
      entityId.startsWith(DEAD_SEED_ENTITY_PREFIX),
      false,
      `${slug} maps to ${entityId}, which is in the retired seed namespace and exists in no release`,
    );
  }
});

test('42 U.S.C. 1983 resolves to the 1871 act it codifies, not a second record for the same statute', () => {
  // The snapshot's own citation and the OLRC source credit both trace § 1983 to the act of
  // Apr. 20, 1871, ch. 22, § 1 — the Ku Klux Klan Act, already published under that name.
  assert.equal(resolveCanonicalEntityId('42-usc-1983'), 'ent_law_ku_klux_klan_act_1871');
});

test('the remaining blanks are the two that were ruled blank, and no others', () => {
  const unlinked = Object.entries(CANONICAL_ENTITY_BY_SLUG)
    .filter(([, entityId]) => entityId === null)
    .map(([slug]) => slug)
    .sort();
  assert.deepEqual(unlinked, ['georgia-sb202-2021', 'title-vii-cfr-part-1604']);
});

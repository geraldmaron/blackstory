/**
 * Guards the defect repo-5tlq was filed against: a legal snapshot pointing at an entity id that
 * exists nowhere. The web seed shipped three of those (`ent_seed_law_1983` and friends) and the
 * surface rendered "View the archive record" for every one of them, because the link is drawn for
 * any non-empty string. Nothing here can reach the database — the live-release check belongs to
 * the loader, which verifies each id against `bb_public.release_entities` before it writes — so
 * these assert the two things a static file can be wrong about: an id from the dead namespace,
 * and a seed row nobody ruled on.
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

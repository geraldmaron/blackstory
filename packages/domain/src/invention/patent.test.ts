import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type CanonicalPatent,
  assertCanonicalPatentValid,
  assertSoleInventorClaimSupported,
  isMultiInventor,
  normalizePatentNumber,
  patentIdFor,
  unresolvedInventors,
} from './patent.ts';

function patent(overrides: Partial<CanonicalPatent> = {}): CanonicalPatent {
  return {
    id: 'pat_us_252386',
    jurisdiction: 'US',
    patentNumber: '252386',
    title: 'Process of Manufacturing Carbons',
    inventors: [{ nameAsPublished: 'Lewis H. Latimer', resolution: 'unresolved' }],
    canonicalSourceItemId: 'src_1',
    sourceSystem: 'uspto',
    ...overrides,
  };
}

test('patent numbers that differ only in presentation normalize to one identity', () => {
  for (const raw of ['252386', 'US252386', 'US 252,386', 'US0252386A', 'us-252386-a']) {
    assert.equal(normalizePatentNumber(raw), '252386', `failed on ${raw}`);
  }
});

test('a series letter is part of the number, so D7 is not patent 7', () => {
  assert.equal(normalizePatentNumber('USD7'), 'D7');
  assert.equal(normalizePatentNumber('7'), '7');
  assert.notEqual(normalizePatentNumber('USD7'), normalizePatentNumber('US7'));
  assert.equal(normalizePatentNumber('RE1234'), 'RE1234');
});

test('Thomas Jennings X-patent keeps its X series', () => {
  // The early Patent Office records were destroyed; X3306 is how the surviving record reads.
  assert.equal(normalizePatentNumber('X3306'), 'X3306');
  assert.equal(normalizePatentNumber('X 3,306'), 'X3306');
});

test('an unreadable number normalizes to undefined rather than to something wrong', () => {
  assert.equal(normalizePatentNumber('not-a-patent'), undefined);
  assert.equal(normalizePatentNumber(''), undefined);
});

test('the same patent written two ways gets one id', () => {
  assert.equal(patentIdFor('US', 'US 252,386'), patentIdFor('US', '0252386'));
  assert.equal(patentIdFor('US', '252386'), 'pat_us_252386');
});

test('a patent naming two inventors cannot support a sole-inventor attribution', () => {
  // US 3,118,022 names West AND Sessler. Centring West is editorial; erasing Sessler is an error.
  const electret = patent({
    patentNumber: '3118022',
    title: 'Electroacoustic Transducer',
    inventors: [
      { nameAsPublished: 'James E. West', resolution: 'resolved', canonicalEntityId: 'ent_west' },
      { nameAsPublished: 'Gerhard M. Sessler', resolution: 'not_in_scope' },
    ],
  });
  assert.ok(isMultiInventor(electret));
  assert.throws(
    () => assertSoleInventorClaimSupported(electret, 'ent_west'),
    /names 2 inventors.*Gerhard M. Sessler/su,
  );
});

test('a genuinely single-inventor patent supports a sole attribution', () => {
  assert.doesNotThrow(() => assertSoleInventorClaimSupported(patent(), 'ent_latimer'));
});

test('a co-inventor outside the catalog is still modeled, not dropped', () => {
  // not_in_scope means "a real person we deliberately do not have a record for", which is very
  // different from the name never having existed.
  const gammaCell = patent({
    patentNumber: '3591860',
    title: 'Gamma-Electric Cell',
    inventors: [
      { nameAsPublished: 'Henry T. Sampson', resolution: 'resolved', canonicalEntityId: 'ent_s' },
      { nameAsPublished: 'George H. Miley', resolution: 'not_in_scope' },
    ],
  });
  assert.equal(gammaCell.inventors.length, 2);
  assert.deepEqual(unresolvedInventors(gammaCell), []);
});

test('an unresolved inventor is a legitimate resting state', () => {
  const p = patent({
    inventors: [
      { nameAsPublished: 'Joseph A. Numero', resolution: 'unresolved' },
      { nameAsPublished: 'Frederick M. Jones', resolution: 'resolved', canonicalEntityId: 'ent_j' },
    ],
  });
  assert.doesNotThrow(() => assertCanonicalPatentValid(p));
  assert.equal(unresolvedInventors(p).length, 1);
});

test('a patent with no named inventors is a parse failure, not a patent', () => {
  assert.throws(() => assertCanonicalPatentValid(patent({ inventors: [] })), /parse failure/u);
});

test('a resolved inventor must carry an entity id, and an unresolved one must not', () => {
  assert.throws(
    () =>
      assertCanonicalPatentValid(
        patent({ inventors: [{ nameAsPublished: 'X', resolution: 'resolved' }] }),
      ),
    /marked resolved with no canonical entity id/u,
  );
  assert.throws(
    () =>
      assertCanonicalPatentValid(
        patent({
          inventors: [
            { nameAsPublished: 'X', resolution: 'unresolved', canonicalEntityId: 'ent_x' },
          ],
        }),
      ),
    /carries a canonical entity id while marked unresolved/u,
  );
});

test('a receipt must say what it was read from', () => {
  assert.throws(
    () => assertCanonicalPatentValid(patent({ canonicalSourceItemId: '  ' })),
    /canonicalSourceItemId is required/u,
  );
});

test('the published inventor name is kept exactly, including its period spelling', () => {
  // Normalizing "Jan E. Matzeliger" away would lose evidence about the document.
  const p = patent({
    patentNumber: '274207',
    title: 'Lasting-Machine',
    inventors: [{ nameAsPublished: 'Jan E. Matzeliger', resolution: 'unresolved' }],
  });
  assert.equal(p.inventors[0]?.nameAsPublished, 'Jan E. Matzeliger');
});

/**
 * Published contact addresses come from one module, and no surface may hardcode its own.
 *
 * Three surfaces publish a mailbox to the open internet: /support, /privacy and
 * /.well-known/security.txt. All three previously hardcoded the same personal address
 * independently, so changing one silently left the others stale. The source scan below is the
 * guard: it fails if any surface grows its own literal again, which is how the drift came back
 * the first time.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SECURITY_CONTACT, SUPPORT_CONTACT } from './contact.js';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every surface that publishes a contact address, and the constant it must read it from. */
const PUBLISHERS = [
  { file: 'app/support/page.tsx', constant: 'SUPPORT_CONTACT' },
  { file: 'app/privacy/PrivacySections.tsx', constant: 'SUPPORT_CONTACT' },
  { file: 'app/.well-known/security.txt/route.ts', constant: 'SECURITY_CONTACT' },
] as const;

for (const publisher of PUBLISHERS) {
  test(`${publisher.file} reads its address from the shared constant`, () => {
    const source = readFileSync(join(srcDir, publisher.file), 'utf8');
    assert.match(source, new RegExp(`\\b${publisher.constant}\\b`));
    assert.match(source, /from '.*lib\/config\/contact'/);
    // A bare address literal is the drift itself, not a style question.
    assert.doesNotMatch(
      source,
      /mailto:[a-z0-9._%+-]+@[a-z0-9.-]+/i,
      'address must be interpolated from the constant, never written inline',
    );
  });
}

test('both published contacts are non-empty addresses', () => {
  for (const address of [SUPPORT_CONTACT, SECURITY_CONTACT]) {
    assert.match(address, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  }
});

test('the decided address is the one that ships when the environment sets nothing', () => {
  // Owner decision, 2026-08-04: this address is the published contact, not a placeholder. Pinned
  // because it is a personal mailbox on two public surfaces — if it ever changes, that should be
  // someone editing this line on purpose rather than a default quietly drifting.
  const expected = 'me@geralddagher.com';
  assert.equal(process.env.SUPPORT_CONTACT?.trim() || SUPPORT_CONTACT, expected);
  assert.equal(process.env.SECURITY_TXT_CONTACT?.trim() || SECURITY_CONTACT, expected);
});

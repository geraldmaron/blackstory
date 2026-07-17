
/**
 * Firestore and Storage security rules tests against local emulators.
 * Skips when emulators are down unless CI_REQUIRE_FIREBASE=1.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const REQUIRE_FIREBASE_ENV = 'CI_REQUIRE_FIREBASE';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FIREBASE_DIR = path.join(ROOT, 'infra/firebase');

function tcpReachable(host: string, port: number, timeoutMs = 750): boolean {
  return (
    spawnSync(
      process.execPath,
      [
        '-e',
        `
      const net = require('net');
      const socket = net.connect(${port}, ${JSON.stringify(host)}, () => {
        socket.end();
        process.exit(0);
      });
      socket.on('error', () => process.exit(1));
      setTimeout(() => process.exit(1), ${timeoutMs});
      `,
      ],
      { encoding: 'utf8' },
    ).status === 0
  );
}

function parseHostPort(
  value: string | undefined,
  fallbackHost: string,
  fallbackPort: number,
): { host: string; port: number } {
  if (!value) return { host: fallbackHost, port: fallbackPort };
  const normalized = value.includes('://') ? value : `http://${value}`;
  const url = new URL(normalized);
  const port = Number(url.port || fallbackPort);
  return { host: url.hostname || fallbackHost, port };
}

function emulatorsReachable(firestorePort: number, storagePort: number): boolean {
  return tcpReachable('127.0.0.1', firestorePort) && tcpReachable('127.0.0.1', storagePort);
}

let testEnv: RulesTestEnvironment | undefined;
let skipReason: string | undefined;

before(async () => {
  const required = process.env[REQUIRE_FIREBASE_ENV] === '1';
  const firestore = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1', 8080);
  const storage = parseHostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1', 9199);

  if (!emulatorsReachable(firestore.port, storage.port)) {
    skipReason = `Firebase emulators not reachable on ${firestore.port}/${storage.port} (pnpm firebase:emulators)`;
    if (required) {
      throw new Error(`${skipReason} (${REQUIRE_FIREBASE_ENV}=1)`);
    }
    return;
  }

  testEnv = await initializeTestEnvironment({
    projectId: 'demo-black-book',
    firestore: {
      rules: readFileSync(path.join(FIREBASE_DIR, 'firestore.rules'), 'utf8'),
      host: firestore.host,
      port: firestore.port,
    },
    storage: {
      rules: readFileSync(path.join(FIREBASE_DIR, 'storage.rules'), 'utf8'),
      host: storage.host,
      port: storage.port,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

async function seedPublicProjection(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('publicMeta/activeRelease').set({
      releaseId: 'rel_rules_001',
      activatedAt: '2026-07-16T18:00:00.000Z',
      searchIndexVersion: 'search_rules_001',
      manifestHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    await db.doc('publicReleases/rel_rules_001/entities/ent_1').set({
      id: 'ent_1',
      releaseId: 'rel_rules_001',
      kind: 'place',
      displayName: 'Rules Fixture Place',
      nameLower: 'rules fixture place',
    });
    await db.doc('canonicalEntities/ent_1').set({
      id: 'ent_1',
      kind: 'place',
      displayName: 'Canonical draft',
      livingStatus: 'unknown',
      createdAt: '2026-07-16T18:00:00.000Z',
      updatedAt: '2026-07-16T18:00:00.000Z',
    });
    await db.doc('researchCases/case_1').set({ title: 'Research only' });
    await db.doc('submissionInbox/sub_other').set({
      status: 'quarantined',
      createdBy: 'other-user',
      createdAt: '2026-07-16T18:00:00.000Z',
    });
  });
}

test('unauthenticated clients can read public projections but not write', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  await seedPublicProjection(testEnv);
  const context = testEnv.unauthenticatedContext();
  const db = context.firestore();
  await assertSucceeds(db.doc('publicMeta/activeRelease').get());
  await assertSucceeds(db.doc('publicReleases/rel_rules_001/entities/ent_1').get());
  await assertFails(db.doc('publicMeta/activeRelease').set({ releaseId: 'hacked' }));
});

test('unauthenticated clients cannot read or write canonical', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  await seedPublicProjection(testEnv);
  const context = testEnv.unauthenticatedContext();
  const doc = context.firestore().doc('canonicalEntities/ent_1');
  await assertFails(doc.get());
  await assertFails(doc.set({ id: 'ent_1', kind: 'place', displayName: 'x' }));
});

test('authenticated users can create quarantine submissions only', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  const uid = 'submitter-1';
  const context = testEnv.authenticatedContext(uid);
  const db = context.firestore();
  await assertSucceeds(
    db.doc('submissionInbox/sub_new').set({
      status: 'quarantined',
      createdBy: uid,
      createdAt: '2026-07-16T18:00:00.000Z',
      kind: 'correction',
    }),
  );
  await assertFails(
    db.doc('submissionInbox/sub_bad').set({
      status: 'published',
      createdBy: uid,
      createdAt: '2026-07-16T18:00:00.000Z',
    }),
  );
  await assertFails(
    db.doc('canonicalEntities/ent_hack').set({
      id: 'ent_hack',
      kind: 'place',
      displayName: 'nope',
    }),
  );
});

test('submitters cannot read other users submissions', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  await seedPublicProjection(testEnv);
  const context = testEnv.authenticatedContext('submitter-1');
  await assertFails(context.firestore().doc('submissionInbox/sub_other').get());
});

test('research claim can read research but cannot write publication or canonical', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  await seedPublicProjection(testEnv);
  const context = testEnv.authenticatedContext('researcher-1', {
    research: true,
    bb_role: 'research',
  });
  const db = context.firestore();
  await assertSucceeds(db.doc('researchCases/case_1').get());
  await assertFails(db.doc('researchCases/case_1').set({ title: 'mutated' }));
  await assertFails(db.doc('publicationReleases/rel_x').set({ id: 'rel_x', status: 'active' }));
  await assertFails(db.doc('canonicalEntities/ent_1').get());
});

test('trusted staff may append valid audit events but nobody may change them', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  const uid = 'publisher-1';
  const publisher = testEnv.authenticatedContext(uid, { publication: true });
  const event = {
    id: 'audit-rules-1',
    action: 'publication.published',
    category: 'publication',
    actor: { id: uid, type: 'user' },
    subject: { type: 'entity', id: 'entity-1', path: 'canonicalEntities/entity-1' },
    reason: 'Approved publication',
    requestId: 'request-rules-1',
    correlationId: 'correlation-rules-1',
    releaseId: 'release-rules-1',
    entityId: 'entity-1',
    idempotencyKey: 'publish:entity-1:release-rules-1',
    occurredAt: '2026-07-16T20:00:00.000Z',
  };
  const ref = publisher.firestore().doc('auditEvents/audit-rules-1');

  await assertSucceeds(ref.set(event));
  await assertFails(ref.update({ reason: 'Rewritten history' }));
  await assertFails(ref.delete());

  const untrusted = testEnv.authenticatedContext('ordinary-user');
  await assertFails(
    untrusted
      .firestore()
      .doc('auditEvents/audit-rules-untrusted')
      .set({ ...event, id: 'audit-rules-untrusted', actor: { id: 'ordinary-user', type: 'user' } }),
  );
});

test('unauthenticated clients cannot read or write evidence or sources', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('evidenceRecords/ev_1').set({
      id: 'ev_1',
      sourceItemId: 'sitm_1',
      sourceId: 'src_1',
      excerptKind: 'none',
      rightsStatus: 'unknown',
      publicationPermissions: [],
      prohibitedUses: [],
      createdAt: '2026-07-16T18:00:00.000Z',
    });
    await db.doc('evidenceSources/src_1').set({
      id: 'src_1',
      displayName: 'Fixture',
      classification: 'primary_archival',
      adapterId: 'fixture',
      stableIdScheme: 'url',
      policy: {
        snapshotMode: 'selective',
        rights: {
          defaultStatus: 'public_domain',
          publicationPermissions: [],
          prohibitedUses: [],
        },
      },
      adapterEnabled: true,
      createdAt: '2026-07-16T18:00:00.000Z',
      updatedAt: '2026-07-16T18:00:00.000Z',
    });
  });
  const context = testEnv.unauthenticatedContext();
  const db = context.firestore();
  await assertFails(db.doc('evidenceRecords/ev_1').get());
  await assertFails(db.doc('evidenceRecords/ev_1').set({ id: 'ev_hack' }));
  await assertFails(db.doc('evidenceSources/src_1').get());
  await assertFails(db.doc('sourceItems/sitm_1').set({ id: 'sitm_1' }));
  await assertFails(db.doc('sourceCaptures/cap_1').set({ id: 'cap_1' }));
  await assertFails(db.doc('evidenceLineage/elin_1').set({ id: 'elin_1' }));
});

test('storage deny-all rejects unauthenticated reads and writes', async (t) => {
  if (!testEnv) {
    t.skip(skipReason ?? 'emulators unavailable');
    return;
  }
  const context = testEnv.unauthenticatedContext();
  const ref = context.storage().ref('probe/object.txt');
  await assertFails(ref.getMetadata());
  await assertFails(ref.putString('denied').then());
});

test('rules harness stays on demo project id', () => {
  assert.equal(process.env.FIREBASE_PROJECT_ID ?? 'demo-black-book', 'demo-black-book');
});

test('audit rules express append-only and protected outbox intent', () => {
  const rules = readFileSync(path.join(FIREBASE_DIR, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/auditEvents\/\{eventId\}/);
  assert.match(rules, /allow create: if isTrustedAuditWriter\(\)/);
  assert.match(rules, /allow update, delete: if false/);
  assert.match(rules, /match \/outboxMessages\/\{messageId\}[\s\S]*allow read, write: if false/);
});

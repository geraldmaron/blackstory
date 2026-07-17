
/**
 * Firebase emulator integration tests (Auth/Firestore demo project).
 * Skips when emulators/Java are unavailable; fails closed when CI_REQUIRE_FIREBASE=1.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFirebaseHarness, firebaseHarnessGate } from './firebase.ts';

const harness = createFirebaseHarness();

test(
  'firebase emulator harness reports demo project when reachable',
  firebaseHarnessGate(harness),
  () => {
    assert.equal(harness.projectId, 'demo-black-book');
    assert.ok(harness.authHost || harness.firestoreHost);
  },
);

test('firebase harness refuses production project ids', () => {
  assert.throws(
    () =>
      createFirebaseHarness({
        FIREBASE_PROJECT_ID: 'black-book-efaaf',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      }),
    /production services/,
  );
});

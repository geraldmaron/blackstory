/**
 * Firestore emulator helpers for `@repo/api-public` integration tests.
 * Clears and seeds demo-repo only; skips when emulators are unreachable unless CI requires Firebase.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { getServerFirestore } from '@repo/firebase';
import type { ApiPublicEmulatorScenario } from '../../../../packages/firebase/fixtures/api-public-emulator-seed.js';
import type { SeedDocument } from '../../../../packages/firebase/fixtures/firestore-seed.js';

export const API_PUBLIC_EMULATOR_ENV: Readonly<Record<string, string>> = {
  FIREBASE_EMULATOR_MODE: '1',
  FIREBASE_PROJECT_ID: 'demo-repo',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

export const REQUIRE_FIREBASE_ENV = 'CI_REQUIRE_FIREBASE';

/** Deletes all documents in the default Firestore emulator database for the demo project. */
export async function clearEmulatorFirestore(
  environment: Readonly<Record<string, string | undefined>> = API_PUBLIC_EMULATOR_ENV,
): Promise<void> {
  const host = environment.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const projectId = environment.FIREBASE_PROJECT_ID ?? 'demo-repo';
  const url = `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to clear Firestore emulator (${response.status} ${response.statusText})`);
  }
}

export async function writeSeedDocuments(
  firestore: Firestore,
  documents: readonly SeedDocument[],
): Promise<void> {
  const batchSize = 400;
  for (let offset = 0; offset < documents.length; offset += batchSize) {
    const batch = firestore.batch();
    for (const doc of documents.slice(offset, offset + batchSize)) {
      batch.set(firestore.doc(doc.path), doc.data, { merge: true });
    }
    await batch.commit();
  }
}

export async function seedEmulatorScenario(
  scenario: ApiPublicEmulatorScenario,
  environment: Readonly<Record<string, string | undefined>> = API_PUBLIC_EMULATOR_ENV,
): Promise<Firestore> {
  await clearEmulatorFirestore(environment);
  const firestore = getServerFirestore(environment);
  await writeSeedDocuments(firestore, scenario.documents);
  return firestore;
}

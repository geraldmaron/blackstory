/**
 * Firestore-backed `ReleaseStore` adapter for MOB-005 mobile release activation.
 *
 * Mirrors the in-memory contract in `@repo/domain` publication/release-activation:
 * content-addressed immutable artifacts, compare-and-set pointer flips inside a Firestore
 * transaction, and structural protection of the active + rollback-target releases.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  ReleaseActivationError,
  type ActiveReleasePointer,
  type GeneratedArtifact,
  type MobileBootstrapManifest,
  type StoredArtifact,
  type StoredRelease,
} from '@repo/domain';
import { createAdminAtomicStore, type AtomicStore, type AtomicTransaction } from './audit-outbox.js';
import { FIRESTORE_ROOT } from './paths.js';

const MOBILE_RELEASE_ARTIFACTS = 'mobileReleaseArtifacts';
const MOBILE_RELEASE_REGISTRY = 'mobileReleaseRegistry';

export const MOBILE_RELEASE_POINTER_PATH = `${FIRESTORE_ROOT.publicMeta}/mobileReleasePointer`;

export type FirestoreReleaseStore = {
  putArtifact(artifact: GeneratedArtifact): Promise<void>;
  getArtifact(path: string): Promise<StoredArtifact | undefined>;
  putRelease(release: StoredRelease): Promise<void>;
  getRelease(releaseId: string): Promise<StoredRelease | undefined>;
  listReleaseIds(): Promise<readonly string[]>;
  deleteRelease(releaseId: string): Promise<void>;
  getPointer(): Promise<ActiveReleasePointer | undefined>;
  flipPointer(next: ActiveReleasePointer, expectedVersion: number): Promise<void>;
};

export type ReleaseStoreBackend = AtomicStore & {
  read(path: string): Promise<Readonly<Record<string, unknown>> | undefined>;
  delete(path: string): Promise<void>;
  listIds(collectionPath: string): Promise<readonly string[]>;
};

type StoredArtifactDoc = {
  readonly path: string;
  readonly hash: StoredArtifact['hash'];
  readonly canonical: string;
  readonly byteLength: number;
};

type StoredReleaseDoc = {
  readonly releaseId: string;
  readonly manifest: MobileBootstrapManifest;
  readonly artifactPaths: readonly string[];
};

const SAFE_RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function assertSafeReleaseId(releaseId: string): void {
  if (!SAFE_RELEASE_ID.test(releaseId) || releaseId === '.' || releaseId === '..') {
    throw new Error(`releaseId is not a safe Firestore document id: ${releaseId}`);
  }
}

function artifactDocumentPath(objectPath: string): string {
  return `${MOBILE_RELEASE_ARTIFACTS}/${Buffer.from(objectPath, 'utf8').toString('base64url')}`;
}

function releaseDocumentPath(releaseId: string): string {
  assertSafeReleaseId(releaseId);
  return `${MOBILE_RELEASE_REGISTRY}/${releaseId}`;
}

function asRecord(value: unknown, context: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function parseStoredArtifactDoc(value: unknown): StoredArtifact {
  const doc = asRecord(value, 'artifact');
  const hash = asRecord(doc.hash, 'artifact.hash');
  if (hash.algorithm !== 'sha256' || typeof hash.digest !== 'string') {
    throw new Error('artifact.hash must be a sha256 digest');
  }
  if (typeof doc.canonical !== 'string' || typeof doc.byteLength !== 'number') {
    throw new Error('artifact canonical payload is invalid');
  }
  return {
    hash: { algorithm: 'sha256', digest: hash.digest },
    canonical: doc.canonical,
    byteLength: doc.byteLength,
  };
}

function parseStoredReleaseDoc(value: unknown): StoredRelease {
  const doc = asRecord(value, 'release');
  if (typeof doc.releaseId !== 'string' || !Array.isArray(doc.artifactPaths)) {
    throw new Error('release document is invalid');
  }
  return {
    releaseId: doc.releaseId,
    manifest: doc.manifest as MobileBootstrapManifest,
    artifactPaths: doc.artifactPaths as readonly string[],
  };
}

function parsePointerDoc(value: unknown): ActiveReleasePointer {
  const doc = asRecord(value, 'pointer');
  if (
    typeof doc.activeReleaseId !== 'string' ||
    typeof doc.releaseStamp !== 'string' ||
    typeof doc.bootstrapPath !== 'string' ||
    typeof doc.activatedAt !== 'string' ||
    typeof doc.pointerVersion !== 'number'
  ) {
    throw new Error('mobile release pointer document is invalid');
  }
  return {
    activeReleaseId: doc.activeReleaseId,
    ...(typeof doc.previousReleaseId === 'string'
      ? { previousReleaseId: doc.previousReleaseId }
      : {}),
    releaseStamp: doc.releaseStamp,
    bootstrapPath: doc.bootstrapPath,
    activatedAt: doc.activatedAt,
    pointerVersion: doc.pointerVersion,
  };
}

function pointerDoc(pointer: ActiveReleasePointer): Readonly<Record<string, unknown>> {
  return {
    activeReleaseId: pointer.activeReleaseId,
    ...(pointer.previousReleaseId !== undefined
      ? { previousReleaseId: pointer.previousReleaseId }
      : {}),
    releaseStamp: pointer.releaseStamp,
    bootstrapPath: pointer.bootstrapPath,
    activatedAt: pointer.activatedAt,
    pointerVersion: pointer.pointerVersion,
  };
}

function artifactDoc(artifact: GeneratedArtifact): StoredArtifactDoc {
  return {
    path: artifact.path,
    hash: artifact.hash,
    canonical: artifact.canonical,
    byteLength: artifact.byteLength,
  };
}

function releaseDoc(release: StoredRelease): StoredReleaseDoc {
  return {
    releaseId: release.releaseId,
    manifest: release.manifest,
    artifactPaths: release.artifactPaths,
  };
}

async function readPointer(
  backend: ReleaseStoreBackend,
): Promise<ActiveReleasePointer | undefined> {
  const value = await backend.read(MOBILE_RELEASE_POINTER_PATH);
  return value === undefined ? undefined : parsePointerDoc(value);
}

function assertImmutableArtifactWrite(
  existing: StoredArtifact | undefined,
  artifact: GeneratedArtifact,
): void {
  if (existing && existing.hash.digest !== artifact.hash.digest) {
    throw new ReleaseActivationError(
      'IMMUTABLE_ARTIFACT_VIOLATION',
      `Refusing to overwrite immutable artifact ${artifact.path} with different content`,
    );
  }
}

function assertProtectedRelease(
  pointer: ActiveReleasePointer | undefined,
  releaseId: string,
): void {
  if (
    pointer &&
    (releaseId === pointer.activeReleaseId || releaseId === pointer.previousReleaseId)
  ) {
    throw new ReleaseActivationError(
      'PROTECTED_RELEASE',
      `Refusing to delete protected release ${releaseId} (active or rollback target)`,
    );
  }
}

async function putArtifactInTransaction(
  transaction: AtomicTransaction,
  artifact: GeneratedArtifact,
): Promise<void> {
  const path = artifactDocumentPath(artifact.path);
  const snapshot = await transaction.get(path);
  const existing = snapshot.exists ? parseStoredArtifactDoc(snapshot.data()) : undefined;
  assertImmutableArtifactWrite(existing, artifact);
  if (existing) {
    return;
  }
  transaction.create(path, artifactDoc(artifact));
}

/** Injectable Firestore release store for tests and custom Admin SDK wiring. */
export function createFirestoreReleaseStore(backend: ReleaseStoreBackend): FirestoreReleaseStore {
  return {
    async putArtifact(artifact) {
      await backend.runTransaction(async (transaction) => {
        await putArtifactInTransaction(transaction, artifact);
      });
    },

    async getArtifact(path) {
      const value = await backend.read(artifactDocumentPath(path));
      return value === undefined ? undefined : parseStoredArtifactDoc(value);
    },

    async putRelease(release) {
      await backend.runTransaction(async (transaction) => {
        const path = releaseDocumentPath(release.releaseId);
        const snapshot = await transaction.get(path);
        if (snapshot.exists) {
          transaction.update(path, releaseDoc(release));
        } else {
          transaction.create(path, releaseDoc(release));
        }
      });
    },

    async getRelease(releaseId) {
      const value = await backend.read(releaseDocumentPath(releaseId));
      return value === undefined ? undefined : parseStoredReleaseDoc(value);
    },

    async listReleaseIds() {
      const ids = await backend.listIds(MOBILE_RELEASE_REGISTRY);
      return [...ids].sort((left, right) => left.localeCompare(right));
    },

    async deleteRelease(releaseId) {
      await backend.runTransaction(async (transaction) => {
        const pointerSnapshot = await transaction.get(MOBILE_RELEASE_POINTER_PATH);
        const pointer = pointerSnapshot.exists
          ? parsePointerDoc(pointerSnapshot.data())
          : undefined;
        assertProtectedRelease(pointer, releaseId);

        const releasePath = releaseDocumentPath(releaseId);
        const releaseSnapshot = await transaction.get(releasePath);
        if (!releaseSnapshot.exists) {
          return;
        }
        const release = parseStoredReleaseDoc(releaseSnapshot.data());
        for (const artifactPath of release.artifactPaths) {
          transaction.delete(artifactDocumentPath(artifactPath));
        }
        transaction.delete(releasePath);
      });
    },

    async getPointer() {
      return readPointer(backend);
    },

    async flipPointer(next, expectedVersion) {
      await backend.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(MOBILE_RELEASE_POINTER_PATH);
        const current = snapshot.exists ? parsePointerDoc(snapshot.data()) : undefined;
        const currentVersion = current?.pointerVersion ?? 0;
        if (currentVersion !== expectedVersion) {
          throw new ReleaseActivationError(
            'CONCURRENT_ACTIVATION',
            `Pointer moved under this activation (expected v${expectedVersion}, found v${currentVersion})`,
          );
        }
        if (snapshot.exists) {
          transaction.update(MOBILE_RELEASE_POINTER_PATH, pointerDoc(next));
        } else {
          transaction.create(MOBILE_RELEASE_POINTER_PATH, pointerDoc(next));
        }
      });
    },
  };
}

/** Production Admin SDK adapter. Emulator-backed integration is a separate follow-up bead. */
export function createAdminFirestoreReleaseStore(firestore: Firestore): FirestoreReleaseStore {
  const atomic = createAdminAtomicStore(firestore);
  const backend: ReleaseStoreBackend = {
    runTransaction: atomic.runTransaction.bind(atomic),
    async read(path) {
      const snapshot = await firestore.doc(path).get();
      return snapshot.exists ? (snapshot.data() as Readonly<Record<string, unknown>>) : undefined;
    },
    async delete(path) {
      await firestore.doc(path).delete();
    },
    async listIds(collectionPath) {
      const snapshot = await firestore.collection(collectionPath).select().get();
      return snapshot.docs.map((document) => document.id);
    },
  };
  return createFirestoreReleaseStore(backend);
}

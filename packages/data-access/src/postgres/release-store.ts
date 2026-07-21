/**
 * Postgres-backed mobile release store for MOB-005 (ADR-020 SoR cutover).
 *
 * Persists immutable release artifacts, release registry rows, and the compare-and-set
 * mobile release pointer in `bb_public.materialized_snapshots` — the same table Firestore
 * `publicMeta/*` docs migrate into. On pointer flip, optionally syncs `bb_public.active_release`
 * and `bb_publication.releases` so api-public Postgres readers see the new active release.
 *
 * GCS/Firebase Storage remains the blob surface for large artifacts in production; snapshot
 * rows store canonical JSON + hashes for validation and rollback drills.
 */
import type pg from 'pg';
import {
  ReleaseActivationError,
  type ActiveReleasePointer,
  type GeneratedArtifact,
  type MobileBootstrapManifest,
  type StoredArtifact,
  type StoredRelease,
} from '@repo/domain';

export const POSTGRES_MOBILE_RELEASE_POINTER_KEY = 'mobileReleasePointer';
export const POSTGRES_MOBILE_RELEASE_REGISTRY_PREFIX = 'mobileReleaseRegistry:';
export const POSTGRES_MOBILE_RELEASE_ARTIFACT_PREFIX = 'mobileReleaseArtifact:';

export type PostgresReleaseStore = {
  putArtifact(artifact: GeneratedArtifact): Promise<void>;
  getArtifact(path: string): Promise<StoredArtifact | undefined>;
  putRelease(release: StoredRelease): Promise<void>;
  getRelease(releaseId: string): Promise<StoredRelease | undefined>;
  listReleaseIds(): Promise<readonly string[]>;
  deleteRelease(releaseId: string): Promise<void>;
  getPointer(): Promise<ActiveReleasePointer | undefined>;
  flipPointer(next: ActiveReleasePointer, expectedVersion: number): Promise<void>;
};

export type PostgresReleaseStoreTransaction = {
  get(key: string): Promise<Readonly<Record<string, unknown>> | undefined>;
  upsert(key: string, payload: Readonly<Record<string, unknown>>): void;
  delete(key: string): void;
};

export type PostgresReleaseStoreBackend = {
  read(key: string): Promise<Readonly<Record<string, unknown>> | undefined>;
  listKeys(prefix: string): Promise<readonly string[]>;
  delete(key: string): Promise<void>;
  runTransaction<T>(
    operation: (transaction: PostgresReleaseStoreTransaction) => Promise<T>,
  ): Promise<T>;
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

function asRecord(value: unknown, context: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function artifactKey(objectPath: string): string {
  return `${POSTGRES_MOBILE_RELEASE_ARTIFACT_PREFIX}${Buffer.from(objectPath, 'utf8').toString('base64url')}`;
}

function registryKey(releaseId: string): string {
  return `${POSTGRES_MOBILE_RELEASE_REGISTRY_PREFIX}${releaseId}`;
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

async function readArtifact(
  backend: PostgresReleaseStoreBackend,
  path: string,
): Promise<StoredArtifact | undefined> {
  const value = await backend.read(artifactKey(path));
  return value === undefined ? undefined : parseStoredArtifactDoc(value);
}

async function putArtifactInTransaction(
  transaction: PostgresReleaseStoreTransaction,
  artifact: GeneratedArtifact,
): Promise<void> {
  const key = artifactKey(artifact.path);
  const existingValue = await transaction.get(key);
  const existing = existingValue ? parseStoredArtifactDoc(existingValue) : undefined;
  assertImmutableArtifactWrite(existing, artifact);
  if (existing) {
    return;
  }
  transaction.upsert(key, artifactDoc(artifact));
}

export function manifestHashFromStamp(releaseStamp: string): string {
  const suffix = releaseStamp.includes('@') ? releaseStamp.split('@')[1]! : releaseStamp;
  return suffix.padEnd(64, '0').slice(0, 64);
}

export type SyncPublicationPointerOptions = {
  readonly client: pg.PoolClient;
  readonly pointer: ActiveReleasePointer;
  readonly manifest: MobileBootstrapManifest;
};

/** Keeps bb_public.active_release aligned with the mobile pointer flip (Postgres SoR). */
export async function syncPublicationPointerRow(
  options: SyncPublicationPointerOptions,
): Promise<void> {
  const { client, pointer, manifest } = options;
  const manifestHash = manifestHashFromStamp(manifest.releaseStamp);
  const searchIndexVersion =
    manifest.searchIndexVersion ?? manifest.activeRelease.releaseId;

  await client.query(
    `INSERT INTO bb_publication.releases
      (id, status, signed_manifest, search_index_version, activated_at, updated_at)
     VALUES ($1, 'active', $2::jsonb, $3, $4::timestamptz, now())
     ON CONFLICT (id) DO UPDATE SET
       status = 'active',
       signed_manifest = EXCLUDED.signed_manifest,
       search_index_version = EXCLUDED.search_index_version,
       activated_at = EXCLUDED.activated_at,
       updated_at = now()`,
    [
      pointer.activeReleaseId,
      JSON.stringify({ mobileBootstrap: manifest, manifestHash }),
      searchIndexVersion,
      pointer.activatedAt,
    ],
  );

  if (pointer.previousReleaseId) {
    await client.query(
      `UPDATE bb_publication.releases
       SET status = 'superseded', updated_at = now()
       WHERE id = $1 AND status = 'active'`,
      [pointer.previousReleaseId],
    );
  }

  await client.query(
    `INSERT INTO bb_public.active_release
      (id, release_id, activated_at, search_index_version, manifest_hash)
     VALUES ('active', $1, $2::timestamptz, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       release_id = EXCLUDED.release_id,
       activated_at = EXCLUDED.activated_at,
       search_index_version = EXCLUDED.search_index_version,
       manifest_hash = EXCLUDED.manifest_hash`,
    [pointer.activeReleaseId, pointer.activatedAt, searchIndexVersion, manifestHash],
  );
}

export function createPostgresReleaseStore(
  backend: PostgresReleaseStoreBackend,
  options: { readonly syncPublicationPointer?: (pointer: ActiveReleasePointer, manifest: MobileBootstrapManifest) => Promise<void> } = {},
): PostgresReleaseStore {
  const syncPublication = options.syncPublicationPointer;

  return {
    async putArtifact(artifact) {
      await backend.runTransaction(async (transaction) => {
        await putArtifactInTransaction(transaction, artifact);
      });
    },

    async getArtifact(path) {
      return readArtifact(backend, path);
    },

    async putRelease(release) {
      await backend.runTransaction(async (transaction) => {
        transaction.upsert(registryKey(release.releaseId), releaseDoc(release));
      });
    },

    async getRelease(releaseId) {
      const value = await backend.read(registryKey(releaseId));
      return value === undefined ? undefined : parseStoredReleaseDoc(value);
    },

    async listReleaseIds() {
      const keys = await backend.listKeys(POSTGRES_MOBILE_RELEASE_REGISTRY_PREFIX);
      return keys
        .map((key) => key.slice(POSTGRES_MOBILE_RELEASE_REGISTRY_PREFIX.length))
        .sort((left, right) => left.localeCompare(right));
    },

    async deleteRelease(releaseId) {
      await backend.runTransaction(async (transaction) => {
        const pointerValue = await transaction.get(POSTGRES_MOBILE_RELEASE_POINTER_KEY);
        const pointer = pointerValue ? parsePointerDoc(pointerValue) : undefined;
        assertProtectedRelease(pointer, releaseId);

        const releaseValue = await transaction.get(registryKey(releaseId));
        if (!releaseValue) {
          return;
        }
        const release = parseStoredReleaseDoc(releaseValue);
        for (const artifactPath of release.artifactPaths) {
          transaction.delete(artifactKey(artifactPath));
        }
        transaction.delete(registryKey(releaseId));
      });
    },

    async getPointer() {
      const value = await backend.read(POSTGRES_MOBILE_RELEASE_POINTER_KEY);
      return value === undefined ? undefined : parsePointerDoc(value);
    },

    async flipPointer(next, expectedVersion) {
      let manifest: MobileBootstrapManifest | undefined;
      await backend.runTransaction(async (transaction) => {
        const currentValue = await transaction.get(POSTGRES_MOBILE_RELEASE_POINTER_KEY);
        const current = currentValue ? parsePointerDoc(currentValue) : undefined;
        const currentVersion = current?.pointerVersion ?? 0;
        if (currentVersion !== expectedVersion) {
          throw new ReleaseActivationError(
            'CONCURRENT_ACTIVATION',
            `Pointer moved under this activation (expected v${expectedVersion}, found v${currentVersion})`,
          );
        }
        transaction.upsert(POSTGRES_MOBILE_RELEASE_POINTER_KEY, pointerDoc(next));

        const releaseValue = await transaction.get(registryKey(next.activeReleaseId));
        if (!releaseValue) {
          throw new ReleaseActivationError(
            'MISSING_RELEASE',
            `Cannot activate ${next.activeReleaseId}: release registry row missing`,
          );
        }
        manifest = parseStoredReleaseDoc(releaseValue).manifest;
      });

      if (syncPublication && manifest) {
        await syncPublication(next, manifest);
      }
    },
  };
}

export function createPoolPostgresReleaseStoreBackend(pool: pg.Pool): PostgresReleaseStoreBackend {
  return {
    async read(key) {
      const result = await pool.query<{ payload: unknown }>(
        `SELECT payload FROM bb_public.materialized_snapshots WHERE name = $1 LIMIT 1`,
        [key],
      );
      const payload = result.rows[0]?.payload;
      if (payload === undefined || payload === null) {
        return undefined;
      }
      return asRecord(payload, `materialized_snapshots.${key}`);
    },

    async listKeys(prefix) {
      const result = await pool.query<{ name: string }>(
        `SELECT name FROM bb_public.materialized_snapshots WHERE name LIKE $1 ORDER BY name`,
        [`${prefix}%`],
      );
      return result.rows.map((row) => row.name);
    },

    async delete(key) {
      await pool.query(`DELETE FROM bb_public.materialized_snapshots WHERE name = $1`, [key]);
    },

    async runTransaction(operation) {
      const client = await pool.connect();
      const pending: Array<
        | { readonly kind: 'upsert'; readonly key: string; readonly payload: Readonly<Record<string, unknown>> }
        | { readonly kind: 'delete'; readonly key: string }
      > = [];
      try {
        await client.query('BEGIN');
        const transaction: PostgresReleaseStoreTransaction = {
          get: async (key) => {
            const result = await client.query<{ payload: unknown }>(
              `SELECT payload FROM bb_public.materialized_snapshots WHERE name = $1 FOR UPDATE`,
              [key],
            );
            const payload = result.rows[0]?.payload;
            return payload === undefined || payload === null
              ? undefined
              : asRecord(payload, `materialized_snapshots.${key}`);
          },
          upsert(key, payload) {
            pending.push({ kind: 'upsert', key, payload });
          },
          delete(key) {
            pending.push({ kind: 'delete', key });
          },
        };
        const result = await operation(transaction);
        for (const write of pending) {
          if (write.kind === 'delete') {
            await client.query(`DELETE FROM bb_public.materialized_snapshots WHERE name = $1`, [
              write.key,
            ]);
            continue;
          }
          await client.query(
            `INSERT INTO bb_public.materialized_snapshots (name, payload, updated_at)
             VALUES ($1, $2::jsonb, now())
             ON CONFLICT (name) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
            [write.key, JSON.stringify(write.payload)],
          );
        }
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Production store: materialized_snapshots + bb_public.active_release sync on pointer flip. */
export function createPoolPostgresReleaseStore(pool: pg.Pool): PostgresReleaseStore {
  const backend = createPoolPostgresReleaseStoreBackend(pool);
  return createPostgresReleaseStore(backend, {
    async syncPublicationPointer(pointer, manifest) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await syncPublicationPointerRow({ client, pointer, manifest });
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw error;
      } finally {
        client.release();
      }
    },
  });
}

/**
 * Pure helpers for restore verification: document counts, collection hashes,
 * and release manifest integrity checks (structure + digest, no live I/O).
 */
import { createHash, verify as verifySignature } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function canonicalize(value, ancestors = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON does not support non-finite numbers');
    }
    return JSON.stringify(value);
  }
  if (ancestors.has(value)) {
    throw new Error('Canonical JSON does not support circular values');
  }
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, next)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], next)}`)
    .join(',')}}`;
}

export function canonicalJson(value) {
  return canonicalize(value);
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Json(value) {
  return sha256Hex(canonicalJson(value));
}

/**
 * @param {Record<string, number>} counts
 * @param {Record<string, number>} baseline
 */
export function compareDocumentCounts(counts, baseline) {
  const mismatches = [];
  const collections = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const collection of collections) {
    const actual = counts[collection] ?? 0;
    const expected = baseline[collection] ?? 0;
    if (actual !== expected) {
      mismatches.push({ collection, actual, expected, delta: actual - expected });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * @param {Record<string, string>} hashes
 * @param {Record<string, string>} baseline
 */
export function compareCollectionHashes(hashes, baseline) {
  const mismatches = [];
  const collections = new Set([...Object.keys(hashes), ...Object.keys(baseline)]);
  for (const collection of collections) {
    const actual = hashes[collection];
    const expected = baseline[collection];
    if (!actual || !SHA256_PATTERN.test(actual)) {
      mismatches.push({ collection, reason: 'missing_or_invalid_actual', actual, expected });
      continue;
    }
    if (expected && actual !== expected) {
      mismatches.push({ collection, reason: 'digest_mismatch', actual, expected });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

function manifestToJson(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    releaseId: manifest.releaseId,
    generatedAt: manifest.generatedAt,
    searchIndexVersion: manifest.searchIndexVersion,
    entries: manifest.entries.map((entry) => ({
      entityId: entry.entityId,
      revision: entry.revision,
      projectionPath: entry.projectionPath,
      projectionHash: { ...entry.projectionHash },
      snapshotPath: entry.snapshotPath,
      snapshotHash: { ...entry.snapshotHash },
    })),
  };
}

/**
 * Verifies manifest envelope structure and manifestHash digest. Signature optional.
 * @param {object} signedManifest
 * @param {import('node:crypto').KeyObject | undefined} publicKey
 */
export function verifyManifestEnvelope(signedManifest, publicKey = undefined) {
  const errors = [];
  const manifest = signedManifest?.manifest;
  const manifestHash = signedManifest?.manifestHash;
  const signature = signedManifest?.signature;

  if (!manifest || manifest.schemaVersion !== 1) {
    errors.push('manifest.schemaVersion must be 1');
  }
  if (!manifest?.releaseId) {
    errors.push('manifest.releaseId is required');
  }
  if (!Array.isArray(manifest?.entries) || manifest.entries.length === 0) {
    errors.push('manifest.entries must be non-empty');
  }

  const entityIds = new Set();
  for (const entry of manifest?.entries ?? []) {
    if (entityIds.has(entry.entityId)) {
      errors.push(`duplicate entityId: ${entry.entityId}`);
    }
    entityIds.add(entry.entityId);
    for (const field of ['projectionHash', 'snapshotHash']) {
      const hash = entry[field];
      if (!hash?.digest || !SHA256_PATTERN.test(hash.digest)) {
        errors.push(`${entry.entityId}.${field} invalid digest`);
      }
    }
  }

  if (manifestHash?.algorithm !== 'sha256' || !SHA256_PATTERN.test(manifestHash?.digest ?? '')) {
    errors.push('manifestHash must be sha256 hex');
  } else if (manifest) {
    const computed = sha256Hex(canonicalJson(manifestToJson(manifest)));
    if (computed !== manifestHash.digest) {
      errors.push('manifestHash digest does not match canonical manifest JSON');
    }
  }

  let signatureValid = null;
  if (publicKey && signature?.value && manifest) {
    const manifestJson = canonicalJson(manifestToJson(manifest));
    try {
      signatureValid = verifySignature(
        'sha256',
        Buffer.from(manifestJson),
        publicKey,
        Buffer.from(signature.value, 'base64'),
      );
      if (!signatureValid) {
        errors.push('manifest signature verification failed');
      }
    } catch {
      errors.push('manifest signature verification errored');
      signatureValid = false;
    }
  }

  return { ok: errors.length === 0, errors, signatureValid };
}

/**
 * @param {object} metadata export sidecar from backup job
 * @param {object} options
 */
export function verifyExportMetadata(metadata, options = {}) {
  const errors = [];
  if (metadata.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  if (!metadata.exportUri?.startsWith('gs://')) {
    errors.push('exportUri must be a gs:// URI');
  }
  if (!metadata.tier) {
    errors.push('tier is required');
  }

  let counts = { ok: true, mismatches: [] };
  if (options.baselineCounts) {
    counts = compareDocumentCounts(metadata.documentCounts ?? {}, options.baselineCounts);
    if (!counts.ok) {
      errors.push(`document count mismatch: ${counts.mismatches.length} collections`);
    }
  }

  let hashes = { ok: true, mismatches: [] };
  if (options.baselineHashes) {
    hashes = compareCollectionHashes(metadata.collectionHashes ?? {}, options.baselineHashes);
    if (!hashes.ok) {
      errors.push(`collection hash mismatch: ${hashes.mismatches.length} collections`);
    }
  }

  const manifestChecks = [];
  for (const check of metadata.releaseManifestChecks ?? []) {
    const result = verifyManifestEnvelope(check.signedManifest);
    manifestChecks.push({ releaseId: check.releaseId, ...result });
    if (!result.ok) {
      errors.push(`release manifest ${check.releaseId} failed: ${result.errors.join('; ')}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts,
    hashes,
    manifestChecks,
  };
}

/**
 * @param {object} activePointer publicMeta/activeRelease shape
 * @param {object} release publicationReleases doc with signedManifest
 */
export function verifyActiveReleasePointer(activePointer, release) {
  const errors = [];
  if (release.status !== 'active') {
    errors.push(`release ${release.id} status is ${release.status}, expected active`);
  }
  if (activePointer.releaseId !== release.id) {
    errors.push('active pointer releaseId mismatch');
  }
  if (activePointer.searchIndexVersion !== release.searchIndexVersion) {
    errors.push('active pointer searchIndexVersion mismatch');
  }
  const digest = release.signedManifest?.manifestHash?.digest;
  if (activePointer.manifestHash !== digest) {
    errors.push('active pointer manifestHash mismatch');
  }
  const envelope = verifyManifestEnvelope(release.signedManifest);
  if (!envelope.ok) {
    errors.push(...envelope.errors);
  }
  return { ok: errors.length === 0, errors, envelope };
}

/**
 * Parses retention matrix and asserts runtime SAs are listed as non-deleters.
 * @param {object} matrix retention-matrix.json
 * @param {string} runtimeServiceAccounts
 */
export function verifyIamMatrixDesign(matrix, runtimeServiceAccounts) {
  const errors = [];
  if (matrix.schemaVersion !== 1) {
    errors.push('retention matrix schemaVersion must be 1');
  }
  if (!matrix.backupBucket?.includes('firestore-backups')) {
    errors.push('backupBucket must name firestore-backups bucket');
  }
  const blocked = runtimeServiceAccounts.filter((sa) => sa === 'backup');
  if (blocked.length > 0) {
    errors.push('backup SA should not appear in runtime deny list');
  }
  return {
    ok: errors.length === 0,
    errors,
    deniedDeletePrincipals: runtimeServiceAccounts.filter((sa) => sa !== 'backup'),
  };
}

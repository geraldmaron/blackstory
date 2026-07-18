/**
 * Data Pack v1 manifest contract (black-book-ud5q).
 *
 * Goal: no third-party's independently-hosted dataset ever becomes a direct, unvetted public
 * dependency of Black Book. A "data pack" is the unit a publisher ships: a signed manifest
 * describing a set of checksummed JSON resources. Everything downstream (validation, import
 * pipeline) works from this contract, never from a live upstream URL directly.
 *
 * Reuses, does NOT reimplement:
 *  - `Sha256Hash`, `canonicalJson`, `sha256Bytes`, `sha256Json` from `../publication/index.js`
 *    (deterministic canonical-JSON + SHA-256 hashing).
 *  - The ECDSA-SHA256 signature shape from `../publication/index.js`'s `SignedReleaseManifest`
 *    (`{algorithm: 'ecdsa-sha256', keyId, value}`) — `SignedDataPackManifest` below mirrors that
 *    wrapper shape (`{manifest, manifestHash, signature}`) exactly, one manifest field layout
 *    away from a second copy-paste of `signReleaseManifest`/`verifySignedReleaseManifest`. The
 *    sign/verify functions here reuse the same primitives (`canonicalJson` + `sha256Bytes` +
 *    node:crypto `sign`/`verify`) rather than forking the hashing/signing algorithm itself; only
 *    the manifest-to-JSON field mapping differs because the manifest shape differs.
 *  - `ExternalSourceLicenseVerdict` / `EXTERNAL_SOURCE_LICENSE_VERDICTS` from
 *    `../external-data-sources.js` for the license vocabulary, instead of inventing a parallel
 *    one.
 *  - `RefreshCadence` / `REFRESH_CADENCES` from `../corpus-vetting.js` for `updateCadence`,
 *    instead of a third cadence enum (corpus-vetting.ts already has one, external-data-sources.ts
 *    has a near-duplicate `cadence` union — this reuses the corpus-vetting one since data packs
 *    are, like vetted corpora, a "vet once, import in structured batches" concept).
 *
 * Eventual target vocabularies this deliberately does NOT implement (cited for future alignment,
 * not built from scratch here): DCAT2 for dataset/distribution metadata, JSON Schema 2020-12 for
 * per-resource shape validation, PROV-O for provenance chains. This is a small, hand-rolled
 * contract sized for the resource kinds Black Book actually ingests.
 */
import { sign as signBytes, verify as verifyBytes, type KeyLike } from 'node:crypto';
import { canonicalJson, sha256Bytes, type JsonValue, type Sha256Hash } from '../publication/index.js';
import { EXTERNAL_SOURCE_LICENSE_VERDICTS, type ExternalSourceLicenseVerdict } from '../external-data-sources.js';
import { isRefreshCadence, type RefreshCadence } from '../corpus-vetting.js';

export const DATA_PACK_SCHEMA_VERSION = 1 as const;

/**
 * The record kinds a pack's resources may contain. Deliberately loose/generic JSON-shaped
 * records at this layer (see `./records.js`) — reconciling them against `CanonicalEntity` /
 * `CanonicalClaim` happens during import, not manifest definition.
 */
export const DATA_PACK_RESOURCE_KINDS = [
  'entities',
  'names',
  'identifiers',
  'locations',
  'claims',
  'relationships',
  'evidence',
] as const;

export type DataPackResourceKind = (typeof DATA_PACK_RESOURCE_KINDS)[number];

export function isDataPackResourceKind(value: string): value is DataPackResourceKind {
  return (DATA_PACK_RESOURCE_KINDS as readonly string[]).includes(value);
}

export type DataPackPublisher = {
  readonly name: string;
  readonly contactUrl?: string;
};

export type DataPackLicense = {
  readonly name: string;
  readonly verdict: ExternalSourceLicenseVerdict;
  readonly notes?: string;
};

export type DataPackResourceManifestEntry = {
  readonly name: string;
  /** Relative path within the pack's resource bundle (not a live URL). */
  readonly path: string;
  readonly kind: DataPackResourceKind;
  readonly sha256: Sha256Hash;
  readonly byteSize: number;
  /** Optional declared record count, used by the budget check when provided. */
  readonly recordCount?: number;
};

/** Loose spatial coverage metadata — free-text place/geography labels, not a geometry engine. */
export type DataPackSpatialCoverage = readonly string[];

/** Loose temporal coverage metadata — simple ISO-date range or free-text label. */
export type DataPackTemporalCoverage = {
  readonly start?: string;
  readonly end?: string;
  readonly label?: string;
};

export type DataPackManifest = {
  readonly schemaVersion: typeof DATA_PACK_SCHEMA_VERSION;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly publisher: DataPackPublisher;
  readonly license: DataPackLicense;
  readonly issuedAt: string;
  readonly modifiedAt: string;
  readonly resources: readonly DataPackResourceManifestEntry[];
  readonly spatialCoverage?: DataPackSpatialCoverage;
  readonly temporalCoverage?: DataPackTemporalCoverage;
  readonly updateCadence: RefreshCadence;
};

/** Mirrors `SignedReleaseManifest` exactly: payload + its hash + an ECDSA-SHA256 signature over
 * that payload, plus the registry-resolvable key id used to look up the verification key (kept
 * distinct from `signature.keyId`, which is the signer's own record of which key it used —
 * normally the same value, but callers should resolve verification keys via `publicKeyId`). */
export type SignedDataPackManifest = {
  readonly manifest: DataPackManifest;
  readonly manifestHash: Sha256Hash;
  readonly signature: {
    readonly algorithm: 'ecdsa-sha256';
    readonly keyId: string;
    readonly value: string;
  };
  readonly publicKeyId: string;
};

const SHA256_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const textEncoder = new TextEncoder();

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible date`);
  }
}

export function assertDataPackManifestShapeValid(manifest: DataPackManifest): void {
  if (manifest.schemaVersion !== DATA_PACK_SCHEMA_VERSION) {
    throw new Error(`Unsupported data pack schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!manifest.datasetId.trim()) throw new Error('datasetId is required');
  if (!manifest.datasetVersion.trim()) throw new Error('datasetVersion is required');
  if (!manifest.publisher.name.trim()) throw new Error('publisher.name is required');
  if (!(EXTERNAL_SOURCE_LICENSE_VERDICTS as readonly string[]).includes(manifest.license.verdict)) {
    throw new Error(`Unknown license verdict: ${manifest.license.verdict}`);
  }
  assertIsoDate(manifest.issuedAt, 'issuedAt');
  assertIsoDate(manifest.modifiedAt, 'modifiedAt');
  if (!isRefreshCadence(manifest.updateCadence)) {
    throw new Error(`Unknown updateCadence: ${manifest.updateCadence}`);
  }
  if (manifest.resources.length === 0) {
    throw new Error('resources must be non-empty');
  }
  const names = new Set<string>();
  for (const resource of manifest.resources) {
    if (!resource.name.trim()) throw new Error('resource name is required');
    if (names.has(resource.name)) throw new Error(`Duplicate resource name: ${resource.name}`);
    names.add(resource.name);
    if (!resource.path.trim()) throw new Error(`resource ${resource.name}: path is required`);
    if (!isDataPackResourceKind(resource.kind)) {
      throw new Error(`resource ${resource.name}: unknown kind ${resource.kind}`);
    }
    if (resource.sha256.algorithm !== 'sha256' || !SHA256_DIGEST_PATTERN.test(resource.sha256.digest)) {
      throw new Error(`resource ${resource.name}: invalid sha256 hash`);
    }
    if (!Number.isInteger(resource.byteSize) || resource.byteSize < 0) {
      throw new Error(`resource ${resource.name}: byteSize must be a non-negative integer`);
    }
  }
}

function resourceEntryToJson(entry: DataPackResourceManifestEntry): JsonValue {
  return {
    name: entry.name,
    path: entry.path,
    kind: entry.kind,
    sha256: { algorithm: entry.sha256.algorithm, digest: entry.sha256.digest },
    byteSize: entry.byteSize,
    ...(entry.recordCount !== undefined ? { recordCount: entry.recordCount } : {}),
  };
}

/** Canonical JSON projection of a manifest — the exact bytes that get hashed and signed. Kept
 * private and reused by both `signDataPackManifest` and `verifySignedDataPackManifest` so the two
 * can never drift apart. */
function manifestToJson(manifest: DataPackManifest): JsonValue {
  return {
    schemaVersion: manifest.schemaVersion,
    datasetId: manifest.datasetId,
    datasetVersion: manifest.datasetVersion,
    publisher: {
      name: manifest.publisher.name,
      ...(manifest.publisher.contactUrl ? { contactUrl: manifest.publisher.contactUrl } : {}),
    },
    license: {
      name: manifest.license.name,
      verdict: manifest.license.verdict,
      ...(manifest.license.notes ? { notes: manifest.license.notes } : {}),
    },
    issuedAt: manifest.issuedAt,
    modifiedAt: manifest.modifiedAt,
    resources: manifest.resources.map(resourceEntryToJson),
    ...(manifest.spatialCoverage ? { spatialCoverage: [...manifest.spatialCoverage] } : {}),
    ...(manifest.temporalCoverage
      ? {
          temporalCoverage: {
            ...(manifest.temporalCoverage.start ? { start: manifest.temporalCoverage.start } : {}),
            ...(manifest.temporalCoverage.end ? { end: manifest.temporalCoverage.end } : {}),
            ...(manifest.temporalCoverage.label ? { label: manifest.temporalCoverage.label } : {}),
          },
        }
      : {}),
    updateCadence: manifest.updateCadence,
  };
}

export function signDataPackManifest(
  manifest: DataPackManifest,
  input: { readonly keyId: string; readonly publicKeyId: string; readonly privateKey: KeyLike },
): SignedDataPackManifest {
  assertDataPackManifestShapeValid(manifest);
  if (!input.keyId) throw new Error('keyId is required');
  if (!input.publicKeyId) throw new Error('publicKeyId is required');
  const manifestJson = canonicalJson(manifestToJson(manifest));
  const manifestHash = sha256Bytes(manifestJson);
  const signature = signBytes('sha256', textEncoder.encode(manifestJson), input.privateKey).toString(
    'base64',
  );
  return Object.freeze({
    manifest,
    manifestHash,
    signature: Object.freeze({
      algorithm: 'ecdsa-sha256' as const,
      keyId: input.keyId,
      value: signature,
    }),
    publicKeyId: input.publicKeyId,
  });
}

export function verifySignedDataPackManifest(
  signed: SignedDataPackManifest,
  publicKey: KeyLike,
): boolean {
  if (
    signed.manifestHash.algorithm !== 'sha256' ||
    !SHA256_DIGEST_PATTERN.test(signed.manifestHash.digest) ||
    signed.signature.algorithm !== 'ecdsa-sha256'
  ) {
    return false;
  }
  const manifestJson = canonicalJson(manifestToJson(signed.manifest));
  if (sha256Bytes(manifestJson).digest !== signed.manifestHash.digest) {
    return false;
  }
  try {
    return verifyBytes(
      'sha256',
      textEncoder.encode(manifestJson),
      publicKey,
      Buffer.from(signed.signature.value, 'base64'),
    );
  } catch {
    // Malformed signature bytes / wrong key type — fail closed rather than throwing.
    return false;
  }
}

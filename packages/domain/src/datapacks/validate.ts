/**
 * Data Pack v1 validation functions (the related workstream): checksum verification, signature
 * verification, budget enforcement, and license/rights eligibility. Each check is a pure,
 * non-throwing function returning a pass/fail + reason so the import pipeline
 * (`./import-pipeline.ts`) can collect every failure instead of stopping at the first one —
 * mirroring the release builder's/`publish-national-catalog.ts`'s "validate everything, name
 * every failure, then decide" pattern.
 *
 * Reuses `sha256Bytes`/`sha256Json` from `../publication/index.js` for checksum verification and
 * `verifySignedDataPackManifest` from `./manifest.js` for signature verification — no hashing or
 * signing logic is reimplemented here.
 */
import type { KeyLike } from 'node:crypto';
import { sha256Bytes, sha256Json, type JsonValue } from '../publication/index.js';
import {
  verifySignedDataPackManifest,
  type DataPackManifest,
  type DataPackResourceManifestEntry,
  type SignedDataPackManifest,
} from './manifest.js';
import type { ExternalSourceLicenseVerdict } from '../external-data-sources.js';

// ---------------------------------------------------------------------------
// Checksum verification
// ---------------------------------------------------------------------------

export type ChecksumCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'checksum_mismatch'; readonly message: string };

/** Verifies a resource's declared sha256 against its raw bytes (or a string payload). */
export function verifyResourceChecksumBytes(
  entry: DataPackResourceManifestEntry,
  bytes: string | Uint8Array,
): ChecksumCheckResult {
  const actual = sha256Bytes(bytes);
  if (actual.digest !== entry.sha256.digest) {
    return {
      ok: false,
      reason: 'checksum_mismatch',
      message: `resource "${entry.name}" sha256 mismatch: manifest declares ${entry.sha256.digest}, got ${actual.digest}`,
    };
  }
  return { ok: true };
}

/** Verifies a resource's declared sha256 against an already-parsed JSON payload (canonicalized
 * before hashing, same as `sha256Json`). Use this when the resource bytes were never persisted
 * separately from the parsed records. */
export function verifyResourceChecksumJson(
  entry: DataPackResourceManifestEntry,
  value: JsonValue,
): ChecksumCheckResult {
  const actual = sha256Json(value);
  if (actual.digest !== entry.sha256.digest) {
    return {
      ok: false,
      reason: 'checksum_mismatch',
      message: `resource "${entry.name}" sha256 mismatch: manifest declares ${entry.sha256.digest}, got ${actual.digest}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export type SignatureCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'signature_invalid'; readonly message: string };

export function verifyManifestSignature(
  signed: SignedDataPackManifest,
  publicKey: KeyLike,
): SignatureCheckResult {
  const valid = verifySignedDataPackManifest(signed, publicKey);
  if (!valid) {
    return {
      ok: false,
      reason: 'signature_invalid',
      message: `data pack "${signed.manifest.datasetId}@${signed.manifest.datasetVersion}" signature failed verification (publicKeyId=${signed.publicKeyId})`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Budget enforcement
// ---------------------------------------------------------------------------

export type DataPackImportBudget = {
  /** Hard cap on the number of resources a single pack may declare. */
  readonly maxResources: number;
  /** Hard cap on the sum of every resource's declared byteSize. */
  readonly maxTotalBytes: number;
  /** Optional per-resource record-count cap, checked only for resources that declare
   * `recordCount` in the manifest. */
  readonly maxRecordsPerResource?: number;
};

export type BudgetCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'budget_exceeded'; readonly message: string };

export function assertDataPackImportBudgetValid(budget: DataPackImportBudget): void {
  if (!Number.isInteger(budget.maxResources) || budget.maxResources < 1) {
    throw new Error('maxResources must be a positive integer');
  }
  if (!Number.isInteger(budget.maxTotalBytes) || budget.maxTotalBytes < 1) {
    throw new Error('maxTotalBytes must be a positive integer');
  }
  if (
    budget.maxRecordsPerResource !== undefined &&
    (!Number.isInteger(budget.maxRecordsPerResource) || budget.maxRecordsPerResource < 1)
  ) {
    throw new Error('maxRecordsPerResource must be a positive integer when set');
  }
}

/** Fail-closed, non-throwing budget check against a manifest's declared resource metadata. */
export function checkDataPackImportBudget(
  manifest: DataPackManifest,
  budget: DataPackImportBudget,
): BudgetCheckResult {
  assertDataPackImportBudgetValid(budget);

  if (manifest.resources.length > budget.maxResources) {
    return {
      ok: false,
      reason: 'budget_exceeded',
      message: `data pack declares ${manifest.resources.length} resources, exceeding the budget cap of ${budget.maxResources}`,
    };
  }

  const totalBytes = manifest.resources.reduce((sum, resource) => sum + resource.byteSize, 0);
  if (totalBytes > budget.maxTotalBytes) {
    return {
      ok: false,
      reason: 'budget_exceeded',
      message: `data pack totals ${totalBytes} bytes, exceeding the budget cap of ${budget.maxTotalBytes}`,
    };
  }

  if (budget.maxRecordsPerResource !== undefined) {
    for (const resource of manifest.resources) {
      if (resource.recordCount !== undefined && resource.recordCount > budget.maxRecordsPerResource) {
        return {
          ok: false,
          reason: 'budget_exceeded',
          message: `resource "${resource.name}" declares ${resource.recordCount} records, exceeding the per-resource budget cap of ${budget.maxRecordsPerResource}`,
        };
      }
    }
  }

  return { ok: true };
}

/** Throwing variant, mirroring `corpus-vetting.ts`'s `assertWithinCorpusBulkImportBudget`. */
export function assertWithinDataPackImportBudget(
  manifest: DataPackManifest,
  budget: DataPackImportBudget,
): void {
  const result = checkDataPackImportBudget(manifest, budget);
  if (!result.ok) {
    throw new Error(`Data pack import blocked: ${result.message} (BB-ud5q fail-closed).`);
  }
}

// ---------------------------------------------------------------------------
// License / rights eligibility
// ---------------------------------------------------------------------------

/** Verdicts eligible for import without a further rights review, mirroring
 * `corpus-vetting.ts`'s `BULK_IMPORT_ELIGIBLE_LICENSE_VERDICTS` gating pattern but projected onto
 * `external-data-sources.ts`'s license vocabulary. `noncommercial` and `unverified` are NOT
 * eligible: neither indicates redistribution/ingestion rights without a human rights review. */
export const DATA_PACK_IMPORT_ELIGIBLE_LICENSE_VERDICTS: readonly ExternalSourceLicenseVerdict[] = [
  'public-domain',
  'attribution-required',
];

export function isDataPackLicenseImportEligible(verdict: ExternalSourceLicenseVerdict): boolean {
  return (DATA_PACK_IMPORT_ELIGIBLE_LICENSE_VERDICTS as readonly string[]).includes(verdict);
}

export type LicenseCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'license_ineligible'; readonly message: string };

export function checkDataPackLicense(manifest: DataPackManifest): LicenseCheckResult {
  if (!isDataPackLicenseImportEligible(manifest.license.verdict)) {
    return {
      ok: false,
      reason: 'license_ineligible',
      message: `data pack "${manifest.datasetId}" license verdict "${manifest.license.verdict}" is not cleared for import without rights review`,
    };
  }
  return { ok: true };
}

/**
 * Content hashing and reproducibility fingerprints for discovery candidates.
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import { hashUtf8, type ContentHash } from '../provenance/hashes.js';
import type { StampedDiscoveryRun } from '../query-packs/types.js';
import type { DiscoveryReproducibilityStamp } from './types.js';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function canonicalize(value: JsonValue, ancestors: ReadonlySet<object>): string {
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

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, nextAncestors)).join(',')}]`;
  }

  const record = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key]!, nextAncestors)}`)
    .join(',')}}`;
}

function canonicalJson(value: JsonValue): string {
  return canonicalize(value, new Set());
}

/** Hash normalized adapter candidate body for deduplication. */
export function hashCandidateContent(record: AdapterCandidateRecord): ContentHash {
  const body: JsonValue = {
    stableIdentifier: record.stableIdentifier,
    title: record.title ?? null,
    canonicalUrl: record.canonicalUrl ?? null,
    classification: record.classification ?? null,
    payload: (record.payload ?? null) as JsonValue,
  };
  return hashUtf8(canonicalJson(body));
}

/**
 * Fingerprint a completed discovery run from source parser versions and query-pack version.
 * Same inputs reproduce the same fingerprint for audit replay.
 */
export function stampDiscoveryReproducibility(
  run: StampedDiscoveryRun,
  sourceParserVersions: readonly string[],
): DiscoveryReproducibilityStamp {
  const sortedVersions = [
    ...new Set(sourceParserVersions.map((v) => v.trim()).filter(Boolean)),
  ].sort();
  const material = canonicalJson({
    sourceParserVersions: sortedVersions,
    queryPackVersionId: run.queryPackVersionId,
    queryPackContentHash: run.queryPackContentHash,
    adapterId: run.adapterId,
    runId: run.runId,
  });
  return {
    sourceParserVersions: sortedVersions,
    queryPackVersionId: run.queryPackVersionId,
    queryPackContentHash: run.queryPackContentHash,
    fingerprint: hashUtf8(material).digest,
  };
}

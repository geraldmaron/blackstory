/**
 * Filters large Chronicling America exports before candidate stamping.
 * OCR full text and image tile blobs are stripped; only essential metadata is retained.
 */
import type { ChroniclingAmericaExportFilterPolicy } from './types.js';

export type ExportFilterResult = {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly filtered: boolean;
  readonly originalBytes: number;
  readonly retainedBytes: number;
  readonly strippedKeys: readonly string[];
};

function estimateJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function pickEssentialKeys(
  raw: Readonly<Record<string, unknown>>,
  essentialKeys: readonly string[],
): Record<string, unknown> {
  const retained: Record<string, unknown> = {};
  for (const key of essentialKeys) {
    if (key in raw) {
      retained[key] = raw[key];
    }
  }
  return retained;
}

export function filterLargeExportPayload(
  raw: Readonly<Record<string, unknown>>,
  policy: ChroniclingAmericaExportFilterPolicy,
): ExportFilterResult {
  const strippedKeys: string[] = [];
  const withoutBulk: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (policy.stripKeys.includes(key)) {
      strippedKeys.push(key);
      continue;
    }
    withoutBulk[key] = value;
  }

  const originalBytes = estimateJsonBytes(raw);
  let payload: Record<string, unknown> = withoutBulk;
  let retainedBytes = estimateJsonBytes(payload);
  let filtered = strippedKeys.length > 0;

  if (retainedBytes > policy.maxPayloadBytes) {
    payload = pickEssentialKeys(withoutBulk, policy.essentialKeys);
    retainedBytes = estimateJsonBytes(payload);
    filtered = true;
  }

  return {
    payload,
    filtered,
    originalBytes,
    retainedBytes,
    strippedKeys,
  };
}

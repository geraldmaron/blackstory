/**
 * Shared helpers for Firestore → Postgres migration (timestamps, jsonb, optional spreads).
 */

export type JsonObject = { readonly [key: string]: unknown };

export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Normalize Firestore Timestamp / Date / ISO string to ISO timestamptz text. */
export function toIsoTimestamp(value: unknown, fallback?: string): string {
  if (value == null) {
    if (fallback !== undefined) return fallback;
    return new Date(0).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toISOString();
    }
    const seconds = maybe._seconds ?? maybe.seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000).toISOString();
    }
  }
  if (fallback !== undefined) return fallback;
  return new Date(0).toISOString();
}

export function omitUndefined<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

/**
 * Convert Firestore-ish values into JSON-safe structures for jsonb columns.
 * Timestamps become ISO strings; undefined keys are dropped.
 */
export function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item));
  if (typeof value === 'object') {
    const maybe = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      try {
        return maybe.toDate().toISOString();
      } catch {
        /* fall through */
      }
    }
    const seconds = maybe._seconds ?? maybe.seconds;
    if (typeof seconds === 'number' && Object.keys(maybe).every((k) =>
      k === 'seconds' || k === '_seconds' || k === 'nanoseconds' || k === '_nanoseconds'
    )) {
      return new Date(seconds * 1000).toISOString();
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      out[key] = toJsonValue(nested);
    }
    return out;
  }
  return String(value);
}

export type CollectionMigrateResult = {
  readonly collection: string;
  readonly target: string;
  readonly read: number;
  readonly written: number;
  readonly skipped: number;
  readonly errors: readonly string[];
};

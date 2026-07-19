/**
 * Shared, environment-neutral zod primitives used across the `v1/*` contract modules.
 *
 * Not exported from the package (no `package.json` "exports" entry points here) — it only exists
 * to keep bound/format rules consistent across schemas without inventing a new convention per
 * file. Pure zod + string/number logic only: no `node:*`, no I/O, no `@repo/*` imports.
 *
 * Bounds below exist specifically to defeat the adversarial "maliciously large DTO" case
 * (ADR-021 / MOB-003 adversarial review): every string and array field in this package has an
 * explicit `max`, so a hostile or buggy upstream response cannot force a client to allocate an
 * unbounded structure just by parsing it.
 */
import { z } from 'zod';

/** A short id (entity id, claim id, release id, receipt code, etc). */
export const idString = (maxLength = 200) => z.string().trim().min(1).max(maxLength);

/** Free text with an explicit upper bound — never `z.string()` unbounded. */
export const boundedText = (maxLength: number, minLength = 0) =>
  z.string().max(maxLength).refine((value) => value.length >= minLength, {
    message: `Expected at least ${minLength} character(s)`,
  });

export const nonEmptyText = (maxLength: number) => boundedText(maxLength, 1);

/**
 * An absolute HTTP(S) URL, bounded in length. Rejects `javascript:`, `data:`, bare paths, etc.
 *
 * Deliberately regex-based rather than `new URL(...)`: the global `URL` constructor is a DOM/Node
 * ambient, and this package's `tsconfig.json` sets `"types": []` specifically so it cannot rely on
 * any host-environment ambient (a compile-time guard against accidental `process`/DOM/Node
 * globals — see that file's comment). A regex check is also a closer match to what a
 * environment-neutral validator should do: structural shape only, no actual network-capable
 * parser.
 */
export const httpUrl = (maxLength = 2000) => {
  const pattern = /^https?:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
  return z
    .string()
    .max(maxLength)
    .refine((value) => pattern.test(value), { message: 'Expected an absolute http(s) URL' });
};

/** ISO-8601 timestamp string. Rejects non-parseable values (adversarial case: invalid dates). */
export const isoTimestamp = () =>
  z.string().max(64).refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected an ISO-8601 timestamp',
  });

/** Bounded array — every list-valued public field must go through this, never bare `z.array()`. */
export const boundedArray = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z.array(item).max(maxItems);

export const DATE_PRECISIONS = ['day', 'month', 'year', 'decade', 'circa'] as const;
export const datePrecisionSchema = z.enum(DATE_PRECISIONS);
export type DatePrecisionV1 = (typeof DATE_PRECISIONS)[number];

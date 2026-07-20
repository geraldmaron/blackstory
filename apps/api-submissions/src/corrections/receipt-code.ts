/**
 * Opaque receipt codes for the api-submissions corrections intake route (MOB-016 / repo-zir9).
 *
 * Mirrors `apps/web/src/app/corrections/receipt-code.ts` byte-for-byte in derivation scheme so the
 * wire shape (`^BB-COR-[A-F0-9]{16}$`, matching mobile's `RECEIPT_CODE_PATTERN`) is identical across
 * surfaces; the pepper is per-surface secret material, so codes minted here are not interchangeable
 * with web's, which is correct — a submitter only ever looks up a receipt against the surface that
 * minted it. A submission id is never returned to a client; the receipt code is a derived, opaque,
 * high-entropy (64-bit hex body) stand-in that is not enumerable and reveals nothing about intake
 * order or volume.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

const RECEIPT_PREFIX = 'BB-COR-';
const RECEIPT_BODY_LENGTH = 16;
const RECEIPT_PATTERN = /^BB-COR-[A-F0-9]{16}$/;

export function createReceiptCode(submissionId: string, pepper: string): string {
  const digest = createHash('sha256')
    .update(`${pepper}\u0001correction-receipt\u0000${submissionId}`)
    .digest('hex')
    .slice(0, RECEIPT_BODY_LENGTH)
    .toUpperCase();
  return `${RECEIPT_PREFIX}${digest}`;
}

/** Digests a caller-supplied receipt code for lookup. Returns `undefined` for a code that does not
 * even match the wire shape, so a malformed lookup never reaches the store. */
export function digestReceiptCode(receiptCode: string, pepper: string): string | undefined {
  if (!RECEIPT_PATTERN.test(receiptCode)) return undefined;
  return createHash('sha256')
    .update(`${pepper}\u0001correction-receipt-lookup\u0000${receiptCode}`)
    .digest('hex');
}

/** Constant-time comparison for any direct receipt-code comparison a caller might add later
 * (the store itself compares pepper-derived digests, which are fixed-length hex and already
 * safe to compare directly, but this stays available for defense-in-depth). */
export function receiptCodesMatch(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

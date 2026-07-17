/**
 * Opaque receipt codes for correction intake. Submitters receive a single code at
 * acceptance time; status lookup requires the exact code there is no browse or enumerate API.
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

export function digestReceiptCode(receiptCode: string, pepper: string): string | undefined {
  if (!RECEIPT_PATTERN.test(receiptCode)) return undefined;
  return createHash('sha256')
    .update(`${pepper}\u0001correction-receipt-lookup\u0000${receiptCode}`)
    .digest('hex');
}

export function receiptCodesMatch(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

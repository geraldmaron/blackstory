/**
 * Opaque receipt-code persistence (MOB-016 #3 & #5).
 *
 * The receipt code is the "small opaque secret / receipt" that MOB-009's
 * SecureStore wrapper was explicitly built for (`src/data/secure-store.ts`
 * `SECRET_KEYS.correctionReceipt`). It goes in the Keychain/Keystore — NEVER the
 * general SQLite cache (that is bulk public projection data; a receipt is a
 * secret lookup key). It is never logged and never placed in a URL/route param.
 *
 * Receipt-code SHAPE is mirrored from web's `receipt-code.ts`
 * (`/^BB-COR-[A-F0-9]{16}$/`). Validating the shape client-side before a status
 * lookup avoids a pointless server round-trip on an obviously-malformed code and
 * gives the user a precise message — it does NOT help enumeration (the code
 * space is 16 hex chars minted from a server pepper; the client neither
 * generates nor browses codes).
 */
import { SECRET_KEYS, type SecretStore } from '@/data/secure-store';

/** Mirrors web `receipt-code.ts` `RECEIPT_PATTERN`. */
export const RECEIPT_CODE_PATTERN = /^BB-COR-[A-F0-9]{16}$/;

export function isReceiptCodeShape(value: string): boolean {
  return RECEIPT_CODE_PATTERN.test(value.trim());
}

/**
 * Persist the most recent receipt code. Called the instant a 202 is parsed,
 * BEFORE any confirmation UI renders — so if the app is killed between the
 * server write and the receipt being shown, the code still survives on the
 * device (requirement #3). SecureStore's size guard rejects anything that isn't
 * a small opaque secret, so bulk content can never be smuggled through here.
 */
export async function persistReceiptCode(secrets: SecretStore, receiptCode: string): Promise<void> {
  await secrets.set(SECRET_KEYS.correctionReceipt, receiptCode);
}

/** Read back the last stored receipt code, if any (e.g. to pre-fill the status
 * lookup after the user returns). Returns `undefined` when none is stored. */
export async function readStoredReceiptCode(secrets: SecretStore): Promise<string | undefined> {
  const stored = await secrets.get(SECRET_KEYS.correctionReceipt);
  return stored && isReceiptCodeShape(stored) ? stored : undefined;
}

/** Clear the stored receipt (explicit user "forget this code" action —
 * ADR-022 clear-deletion posture). */
export async function clearStoredReceiptCode(secrets: SecretStore): Promise<void> {
  await secrets.delete(SECRET_KEYS.correctionReceipt);
}

import { createSecretStore, SECRET_KEYS, type SecretBackend } from '@/data/secure-store';
import {
  clearStoredReceiptCode,
  isReceiptCodeShape,
  persistReceiptCode,
  readStoredReceiptCode,
} from './receipt';

function fakeBackend(): SecretBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async setItemAsync(k, v) {
      store.set(k, v);
    },
    async getItemAsync(k) {
      return store.get(k) ?? null;
    },
    async deleteItemAsync(k) {
      store.delete(k);
    },
  };
}

const CODE = 'BB-COR-ABCDEF0123456789';

describe('receipt-code persistence (SecureStore, never SQLite)', () => {
  it('validates the receipt shape mirrored from web receipt-code.ts', () => {
    expect(isReceiptCodeShape(CODE)).toBe(true);
    expect(isReceiptCodeShape('BB-COR-abcdef0123456789')).toBe(false); // lowercase hex
    expect(isReceiptCodeShape('BB-COR-XYZ')).toBe(false);
    expect(isReceiptCodeShape('not-a-code')).toBe(false);
  });

  it('round-trips a receipt through the SecureStore-backed secret store', async () => {
    const backend = fakeBackend();
    const secrets = createSecretStore(backend);
    await persistReceiptCode(secrets, CODE);
    // Stored under the dedicated correction-receipt key, not a general cache key.
    expect(backend.store.get(SECRET_KEYS.correctionReceipt)).toBe(CODE);
    expect(await readStoredReceiptCode(secrets)).toBe(CODE);
  });

  it('ignores a stored value that is not a well-formed receipt', async () => {
    const backend = fakeBackend();
    backend.store.set(SECRET_KEYS.correctionReceipt, 'garbage');
    const secrets = createSecretStore(backend);
    expect(await readStoredReceiptCode(secrets)).toBeUndefined();
  });

  it('supports explicit deletion (clear-deletion posture)', async () => {
    const backend = fakeBackend();
    const secrets = createSecretStore(backend);
    await persistReceiptCode(secrets, CODE);
    await clearStoredReceiptCode(secrets);
    expect(await readStoredReceiptCode(secrets)).toBeUndefined();
  });
});

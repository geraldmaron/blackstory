import {
  createSecretStore,
  assertSmallSecret,
  SecretTooLargeError,
  SECRET_KEYS,
  MAX_SECRET_BYTES,
  type SecretBackend,
} from './secure-store';

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

describe('SecureStore is bounded to small opaque secrets (§7)', () => {
  it('accepts a small secret (a salt/receipt) and round-trips it', async () => {
    const backend = fakeBackend();
    const secrets = createSecretStore(backend);
    await secrets.set(SECRET_KEYS.searchSalt, 'abc123');
    expect(await secrets.get(SECRET_KEYS.searchSalt)).toBe('abc123');
    await secrets.delete(SECRET_KEYS.searchSalt);
    expect(await secrets.get(SECRET_KEYS.searchSalt)).toBeUndefined();
  });

  it('REJECTS bulk content BEFORE it reaches the keychain', async () => {
    const backend = fakeBackend();
    const secrets = createSecretStore(backend);
    const bulk = 'x'.repeat(MAX_SECRET_BYTES + 1);
    await expect(secrets.set(SECRET_KEYS.correctionReceipt, bulk)).rejects.toBeInstanceOf(
      SecretTooLargeError,
    );
    // Nothing was written — the guard fires before the backend call.
    expect(backend.store.size).toBe(0);
  });

  it('assertSmallSecret is a pure guard', () => {
    expect(() => assertSmallSecret('ok')).not.toThrow();
    expect(() => assertSmallSecret('x'.repeat(MAX_SECRET_BYTES + 1))).toThrow(SecretTooLargeError);
  });
});

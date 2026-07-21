import { createMemoryStore, createManualConnectivity, META_KEYS } from '../data';
import {
  initializeObservability,
  resolveReportContext,
  refreshReportContext,
} from './bootstrap';
import { getActiveReportContext, getObservabilityConfig, __resetObservabilityForTests } from './crash-reporter';

/**
 * Integration-style smoke tests for the runtime wiring layer. Unlike
 * `src/security/bootstrap.ts` (its App Check counterpart, which has no
 * dedicated test file — the pure modules it wires carry the real test
 * coverage), this module's core assembly logic is cheap to exercise against
 * the real in-memory `CacheStore` / `Connectivity` test doubles already
 * built for MOB-009, so we do — but the bar here is "never throws and wires
 * the pieces together correctly," not exhaustive Constants-mock coverage
 * (Expo's own jest-expo preset provides `expo-constants`, so `Constants.expoConfig`
 * reflects this repo's real `app.config.ts` in the test runner).
 */

beforeEach(() => {
  __resetObservabilityForTests();
});

afterEach(() => {
  __resetObservabilityForTests();
});

describe('resolveReportContext', () => {
  it('assembles a report context from the cache diagnostics and connectivity state', async () => {
    const store = createMemoryStore();
    await store.ensureSchema();
    await store.setMeta(META_KEYS.releaseId, 'release-2026-07-19');
    const connectivity = createManualConnectivity('online');

    const context = await resolveReportContext(store, connectivity);

    expect(context.releaseId).toBe('release-2026-07-19');
    expect(context.degraded).toBe(false);
    expect(typeof context.schemaVersion).toBe('number');
    // platform is whatever the jest-expo test environment reports; must
    // never be empty/undefined — always a resolved or "unknown" string.
    expect(typeof context.platform).toBe('string');
    expect(context.platform.length).toBeGreaterThan(0);
  });

  it('marks the context degraded when connectivity reports offline', async () => {
    const store = createMemoryStore();
    await store.ensureSchema();
    const connectivity = createManualConnectivity('offline');

    const context = await resolveReportContext(store, connectivity);
    expect(context.degraded).toBe(true);
  });

  it('never throws even if the cache store diagnostics call rejects', async () => {
    const store = createMemoryStore();
    // Deliberately do NOT call ensureSchema — some memory-store operations
    // may still succeed on an empty map, but resolveReportContext itself
    // must not throw regardless.
    const connectivity = createManualConnectivity('unknown');
    await expect(resolveReportContext(store, connectivity)).resolves.toBeDefined();
  });
});

describe('initializeObservability', () => {
  it('never throws and returns a result even with no native SDK present (default sandbox/CI state)', async () => {
    const store = createMemoryStore();
    await store.ensureSchema();
    const connectivity = createManualConnectivity('online');

    const result = await initializeObservability(store, connectivity);
    expect(result).toEqual({ initialized: true, observabilityEnabled: true });
    expect(getObservabilityConfig().observabilityEnabled).toBe(true);
    expect(getActiveReportContext().degraded).toBe(false);
  });
});

describe('refreshReportContext', () => {
  it('updates the active report context without throwing', async () => {
    const store = createMemoryStore();
    await store.ensureSchema();
    await store.setMeta(META_KEYS.releaseId, 'release-a');
    const connectivity = createManualConnectivity('online');

    await refreshReportContext(store, connectivity);
    expect(getActiveReportContext().releaseId).toBe('release-a');

    await store.setMeta(META_KEYS.releaseId, 'release-b');
    await refreshReportContext(store, connectivity);
    expect(getActiveReportContext().releaseId).toBe('release-b');
  });
});

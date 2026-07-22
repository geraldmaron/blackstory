/**
 * MOB-016 #5/#7 regression: correction content, contact info, and the receipt
 * code must NEVER reach console/breadcrumbs, and must never be encoded into a
 * route/URL param.
 *
 * Two independent checks:
 *   A. Behavioral — run the full submit + status flow with distinctive marker
 *      values and assert nothing was written to any `console.*` sink.
 *   B. Static — scan the new route files (submit.tsx, status.tsx) and assert
 *      they never pass a receipt/statement/contact into a router navigation call
 *      or a query string (the same property route-params.ts already guarantees
 *      for correction *content*, now re-asserted for these routes and the
 *      receipt code).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { createSecretStore, type SecretBackend } from '@/data/secure-store';
import { lookupCorrectionStatus, submitCorrection, type CorrectionClientDeps } from './client';
import type { CorrectionFormState } from './validation';

const STATEMENT_MARKER = 'ZZ_SECRET_STATEMENT_MARKER_ZZ';
const CONTACT_MARKER = 'zz_secret_contact_marker_zz@example.org';
const RECEIPT = 'BB-COR-ABCDEF0123456789';

function fakeBackend(): SecretBackend {
  const store = new Map<string, string>();
  return {
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

function makeResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response;
}

describe('A. no correction content or receipt reaches any console sink', () => {
  const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

  it('emits nothing sensitive to console across submit + status lookup', async () => {
    const spies = CONSOLE_METHODS.map((m) => jest.spyOn(console, m).mockImplementation(() => {}));

    const form: CorrectionFormState = {
      targetType: 'entity',
      targetRecordId: 'ent_caam_los_angeles_001',
      category: 'factual_error',
      statement: `The founding year is wrong. ${STATEMENT_MARKER}`,
      sourceUrl: 'https://example.org/evidence',
      contact: CONTACT_MARKER,
      privacyConsent: true,
      contactConsent: true,
    };
    const deps: CorrectionClientDeps = {
      baseUrl: 'https://submissions.blackbook.app',
      clientVersion: '1.0.0',
      fetch: (async () =>
        makeResponse(202, { accepted: true, receiptCode: RECEIPT, statusHref: '/x' })) as unknown as typeof fetch,
      secrets: createSecretStore(fakeBackend()),
    };

    await submitCorrection(form, deps);
    await lookupCorrectionStatus(RECEIPT, {
      ...deps,
      fetch: (async () =>
        makeResponse(200, {
          status: {
            phase: 'received',
            receiptCode: RECEIPT,
            submittedAt: 't',
            updatedAt: 't',
            appealAvailable: false,
            classificationDispute: false,
          },
        })) as unknown as typeof fetch,
    });

    const allArgs = spies.flatMap((spy) => spy.mock.calls.flat()).map((a) => JSON.stringify(a));
    for (const arg of allArgs) {
      expect(arg).not.toContain(STATEMENT_MARKER);
      expect(arg).not.toContain(CONTACT_MARKER);
      expect(arg).not.toContain(RECEIPT);
    }
    spies.forEach((s) => s.mockRestore());
  });
});

describe('B. route files never encode content/receipt into a URL or router nav', () => {
  const ROUTE_DIR = join(__dirname, '..', '..', 'app', 'corrections');
  const routeFiles = ['submit.tsx', 'status.tsx'].map((f) => ({
    name: f,
    source: readFileSync(join(ROUTE_DIR, f), 'utf8'),
  }));

  it.each(routeFiles)('$name does not pass receipt/statement/contact into a router navigation call', ({ source }) => {
    // No router.push/replace/navigate/setParams call carrying a sensitive value.
    expect(source).not.toMatch(/router\.(push|replace|navigate|setParams)\([^)]*(receipt|statement|contact)/i);
    // No actual setParams(...) call at all (would push state into the URL).
    expect(source).not.toMatch(/\.setParams\s*\(/);
    // No `?receipt=` / `&receipt=` query-string construction.
    expect(source).not.toMatch(/[?&]receipt=/i);
  });

  it.each(routeFiles)('$name does not read a receipt/statement/contact from route params', ({ source }) => {
    expect(source).not.toMatch(/params\.(receipt|statement|contact)/i);
  });
});

import { createManualConnectivity } from '@/data/offline';
import { createSecretStore, SECRET_KEYS, type SecretBackend, type SecretStore } from '@/data/secure-store';
import { APP_CHECK_HEADER } from '@/security/api-client';
import {
  CORRECTION_STATUS_PATH,
  CORRECTION_SUBMIT_PATH,
  IDEMPOTENCY_KEY_HEADER,
} from './contract';
import {
  lookupCorrectionStatus,
  submitCorrection,
  type CorrectionClientDeps,
} from './client';
import type { CorrectionFormState } from './validation';

const BASE = 'https://submissions.blackbook.app';
const RECEIPT = 'BB-COR-ABCDEF0123456789';

const validForm: CorrectionFormState = {
  targetType: 'entity',
  targetRecordId: 'ent_caam_los_angeles_001',
  category: 'factual_error',
  statement: 'The founding year is wrong and should read 1976, not 1977.',
  sourceUrl: 'https://example.org/evidence',
  contact: '',
  privacyConsent: true,
  contactConsent: false,
};

type Call = { url: string; init: RequestInit };

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

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    json: async () => body,
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

function makeDeps(overrides: Partial<CorrectionClientDeps> = {}): {
  deps: CorrectionClientDeps;
  calls: Call[];
  secrets: SecretStore;
  fetchMock: jest.Mock;
} {
  const calls: Call[] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return makeResponse(202, { accepted: true, receiptCode: RECEIPT, statusHref: '/x' });
  });
  const secrets = createSecretStore(fakeBackend());
  const deps: CorrectionClientDeps = {
    baseUrl: BASE,
    clientVersion: '1.2.3',
    getToken: async () => 'attestation-jwt',
    fetch: fetchMock as unknown as typeof fetch,
    secrets,
    ...overrides,
  };
  return { deps, calls, secrets, fetchMock };
}

describe('submitCorrection — App Check fail-CLOSED (MOB-016 #2)', () => {
  it('does NOT send the write when no attestation token is available', async () => {
    const { deps, fetchMock } = makeDeps({ getToken: async () => null });
    const result = await submitCorrection(validForm, deps);
    expect(result.status).toBe('app_check_unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a server attestation rejection (403) as the same fail-closed affordance', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(makeResponse(403, { error: 'app_check_required' }));
    expect((await submitCorrection(validForm, deps)).status).toBe('app_check_unavailable');
  });
});

describe('submitCorrection — offline (no silent queue, MOB-016 #6)', () => {
  it('refuses to submit while offline and never touches the network or token', async () => {
    const connectivity = createManualConnectivity('offline');
    const getToken = jest.fn(async () => 'attestation-jwt');
    const { deps, fetchMock } = makeDeps({ connectivity, getToken });
    expect((await submitCorrection(validForm, deps)).status).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('submitCorrection — happy path + receipt persistence (MOB-016 #3)', () => {
  it('POSTs to the submit path with attestation + idempotency headers and content in the BODY (not URL)', async () => {
    const { deps, calls } = makeDeps();
    const result = await submitCorrection(validForm, deps);
    expect(result).toMatchObject({ status: 'accepted', receiptCode: RECEIPT });

    const call = calls[0];
    expect(call.url).toBe(`${BASE}${CORRECTION_SUBMIT_PATH}`);
    // No query string / no content in the URL.
    expect(call.url).not.toContain('?');
    expect(call.url).not.toContain('founding');
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers[APP_CHECK_HEADER]).toBe('attestation-jwt');
    expect(headers[IDEMPOTENCY_KEY_HEADER]).toMatch(/^bbcor-/);
    expect(String(call.init.body)).toContain('founding'); // content rides the body
  });

  it('persists the receipt to SecureStore BEFORE resolving (survives kill-before-display)', async () => {
    const { deps, secrets } = makeDeps();
    await submitCorrection(validForm, deps);
    // By the time submit resolves, the receipt is already stored — a UI that
    // never rendered would still find it.
    expect(await secrets.get(SECRET_KEYS.correctionReceipt)).toBe(RECEIPT);
  });

  it('sends a stable idempotency key across a retry of identical content', async () => {
    const { deps, calls } = makeDeps();
    await submitCorrection(validForm, deps);
    await submitCorrection(validForm, deps);
    const key1 = (calls[0].init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER];
    const key2 = (calls[1].init.headers as Record<string, string>)[IDEMPOTENCY_KEY_HEADER];
    expect(key1).toBe(key2);
  });

  it('treats a 202 without a well-formed receipt as an error (does not fabricate one)', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(makeResponse(202, { accepted: true, receiptCode: 'garbage' }));
    expect((await submitCorrection(validForm, deps)).status).toBe('error');
  });
});

describe('submitCorrection — validation, rate limit, network errors', () => {
  it('short-circuits on client-invalid input without a network call', async () => {
    const { deps, fetchMock } = makeDeps();
    const result = await submitCorrection({ ...validForm, statement: 'short' }, deps);
    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a server 400 validation_failed to invalid issues', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(
      makeResponse(400, { error: 'validation_failed', issues: [{ field: 'statement', message: 'x' }] }),
    );
    const result = await submitCorrection(validForm, deps);
    expect(result).toMatchObject({ status: 'invalid' });
  });

  it('maps 429 to a generic rate-limited result with retry-after', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(makeResponse(429, { error: 'rate_limited' }, { 'retry-after': '42' }));
    expect(await submitCorrection(validForm, deps)).toEqual({ status: 'rate_limited', retryAfterSeconds: 42 });
  });

  it('maps a network throw to a generic error', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    expect((await submitCorrection(validForm, deps)).status).toBe('error');
  });
});

describe('lookupCorrectionStatus — status lookup (MOB-016 #4)', () => {
  it('rejects a malformed receipt code client-side without a network call', async () => {
    const { deps, fetchMock } = makeDeps();
    expect((await lookupCorrectionStatus('not-a-code', deps)).status).toBe('invalid_code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the receipt in the BODY, never a ?receipt= URL/query string', async () => {
    const { deps, calls, fetchMock } = makeDeps();
    fetchMock.mockImplementationOnce(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return makeResponse(200, {
        status: {
          phase: 'received',
          receiptCode: RECEIPT,
          submittedAt: 't0',
          updatedAt: 't1',
          appealAvailable: false,
          classificationDispute: false,
        },
      });
    });
    const result = await lookupCorrectionStatus(RECEIPT, deps);
    expect(result).toMatchObject({ status: 'found' });
    expect(calls[0].url).toBe(`${BASE}${CORRECTION_STATUS_PATH}`);
    expect(calls[0].url).not.toContain('receipt');
    expect(String(calls[0].init.body)).toContain(RECEIPT);
  });

  it('returns a non-revealing not_found for an unknown code (no moderation-state leak)', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(makeResponse(404, { error: 'not_found' }));
    expect((await lookupCorrectionStatus(RECEIPT, deps)).status).toBe('not_found');
  });

  it('maps 429 to a generic rate-limited result (mirrors non-revealing rate-limit behavior)', async () => {
    const { deps, fetchMock } = makeDeps();
    fetchMock.mockResolvedValueOnce(makeResponse(429, { error: 'rate_limited' }));
    expect((await lookupCorrectionStatus(RECEIPT, deps)).status).toBe('rate_limited');
  });

  it('refuses lookup while offline', async () => {
    const { deps, fetchMock } = makeDeps({ connectivity: createManualConnectivity('offline') });
    expect((await lookupCorrectionStatus(RECEIPT, deps)).status).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

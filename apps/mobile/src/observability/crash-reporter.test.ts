import {
  reportError,
  addBreadcrumb,
  startPerfTrace,
  reportPerf,
  redactAndCapContext,
  setActiveReportContext,
  setObservabilityConfig,
  getObservabilityConfig,
  __resetObservabilityForTests,
  MAX_CONTEXT_SERIALIZED_BYTES,
  MAX_BREADCRUMB_MESSAGE_LENGTH,
} from './crash-reporter';
import { buildReportContext } from './report-context';

beforeEach(() => {
  __resetObservabilityForTests();
  setObservabilityConfig({ observabilityEnabled: true, performanceSampleRate: 1 });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  __resetObservabilityForTests();
  jest.restoreAllMocks();
});

describe('reportError — graceful failure (bead requirement 5)', () => {
  it('never throws when logging is enabled in dev', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('never throws when console.error throws', () => {
    (console.error as jest.Mock).mockImplementation(() => {
      throw new Error('console exploded');
    });
    expect(() => reportError(new Error('boom'), { context: { note: 'safe' } })).not.toThrow();
  });

  it('logs a normalized error and does not throw for non-Error inputs', () => {
    expect(() => reportError('a plain string error')).not.toThrow();
    expect(() => reportError({ some: 'object' })).not.toThrow();
    expect(() => reportError(undefined)).not.toThrow();
    expect(() => reportError(null)).not.toThrow();

    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => reportError(circular)).not.toThrow();

    expect(console.error).toHaveBeenCalled();
  });

  it('does nothing and never touches console when observabilityEnabled is false', () => {
    setObservabilityConfig({ observabilityEnabled: false, performanceSampleRate: 1 });
    expect(getObservabilityConfig().observabilityEnabled).toBe(false);
    expect(() => reportError(new Error('should be swallowed'))).not.toThrow();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('reportError — redaction pipeline is mandatory (privacy invariant 7)', () => {
  const SENSITIVE_CORPUS = {
    searchQuery: 'Tulsa massacre 1921 survivors',
    q: 'sundown town Anna Illinois',
    correctionContent: 'The record misstates the date; it should read March 3, 1863.',
    location: { latitude: 40.7128, longitude: -74.006 },
    note: 'last seen near 40.7128,-74.0060 downtown',
    citationUrl: 'https://archives.gov/evidence/12345',
    sourceUrl: 'https://loc.gov/item/abc',
    classification: 'protected-living-person',
    era: 'antebellum',
    appCheckToken:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  };

  it('scrubs every sensitive category before the console.error call', () => {
    reportError(new Error('view failed'), { context: SENSITIVE_CORPUS });

    expect(console.error).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify((console.error as jest.Mock).mock.calls[0]);

    expect(serialized).not.toContain('Tulsa');
    expect(serialized).not.toContain('sundown town');
    expect(serialized).not.toContain('March 3, 1863');
    expect(serialized).not.toContain('40.7128');
    expect(serialized).not.toContain('archives.gov');
    expect(serialized).not.toContain('loc.gov');
    expect(serialized).not.toContain('protected-living-person');
    expect(serialized).not.toContain('antebellum');
    expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('scrubs a sensitive value smuggled under an innocuous key (defence in depth)', () => {
    reportError(new Error('x'), {
      context: {
        debugField:
          'attaching token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        innocuousNote: 'user was at 40.7128,-74.0060',
      },
    });
    const serialized = JSON.stringify((console.error as jest.Mock).mock.calls[0]);
    expect(serialized).toContain('[redacted]');
    expect(serialized).not.toContain('40.7128');
  });

  it('scrubs a coordinate pattern embedded in an Error message/stack passed as context', () => {
    const err = new Error('request failed for query "Tulsa massacre" at 40.7128,-74.0060');
    reportError(new Error('outer'), { context: { originalError: err } });
    const serialized = JSON.stringify((console.error as jest.Mock).mock.calls[0]);
    expect(serialized).not.toContain('40.7128');
  });
});

describe('redactAndCapContext — adversarial payload shapes (bead requirement 9)', () => {
  it('handles a recursive/circular object without infinite-looping or throwing', () => {
    const circular: Record<string, unknown> = { paragraphs: ['a', 'b'] };
    circular.self = circular;
    circular.nested = { backToParent: circular };

    expect(() => redactAndCapContext(circular)).not.toThrow();
    const result = redactAndCapContext(circular);
    expect(result).toBeDefined();
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('caps an unbounded/huge context payload rather than sending it whole', () => {
    const huge = { blob: 'x'.repeat(MAX_CONTEXT_SERIALIZED_BYTES * 4) };
    const result = redactAndCapContext(huge) as Record<string, unknown>;
    expect(result.contextTruncated).toBe(true);
    expect(typeof result.preview).toBe('string');
    expect((result.preview as string).length).toBeLessThan(MAX_CONTEXT_SERIALIZED_BYTES + 200);
    expect(result.originalSerializedLength).toBeGreaterThan(MAX_CONTEXT_SERIALIZED_BYTES);
  });

  it('a huge payload is also capped end-to-end through reportError, never sent unbounded', () => {
    const huge = { blob: 'y'.repeat(MAX_CONTEXT_SERIALIZED_BYTES * 8) };
    reportError(new Error('x'), { context: huge });
    const serialized = JSON.stringify((console.error as jest.Mock).mock.calls[0]);
    expect(serialized.length).toBeLessThan(MAX_CONTEXT_SERIALIZED_BYTES * 2);
  });

  it('a small/normal payload passes through unmodified (no spurious truncation)', () => {
    const small = { screen: 'EntityDetail', action: 'tap-share' };
    const result = redactAndCapContext(small);
    expect(result).toEqual(small);
  });

  it('returns undefined for undefined input (no context to scrub)', () => {
    expect(redactAndCapContext(undefined)).toBeUndefined();
  });

  it('degrades safely on exotic value types (e.g. BigInt) rather than throwing', () => {
    const withBigInt = { count: BigInt(10) } as unknown as Record<string, unknown>;
    expect(() => redactAndCapContext(withBigInt)).not.toThrow();
  });
});

describe('addBreadcrumb', () => {
  it('never throws and truncates an overlong message rather than sending it unbounded', () => {
    const longMessage = 'y'.repeat(5000);

    expect(() => addBreadcrumb(longMessage)).not.toThrow();
    const sentLine = (console.debug as jest.Mock).mock.calls[0][1] as string;
    expect(sentLine.length).toBeLessThanOrEqual(MAX_BREADCRUMB_MESSAGE_LENGTH + 60);
  });

  it('redacts sensitive fields carried in the structured `data` parameter', () => {
    expect(() =>
      addBreadcrumb('short message', { citationUrl: 'https://loc.gov/x' }),
    ).not.toThrow();
    const sentLine = (console.debug as jest.Mock).mock.calls[0][1] as string;
    expect(sentLine).not.toContain('loc.gov');

    (console.debug as jest.Mock).mockClear();
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    addBreadcrumb(`token attached: ${jwt}`);
    const sentLine2 = (console.debug as jest.Mock).mock.calls[0][1] as string;
    expect(sentLine2).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('is a no-op and never touches console when observability is disabled', () => {
    setObservabilityConfig({ observabilityEnabled: false, performanceSampleRate: 1 });
    expect(() => addBreadcrumb('anything')).not.toThrow();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('never throws when the console.debug call itself throws', () => {
    (console.debug as jest.Mock).mockImplementation(() => {
      throw new Error('console exploded');
    });
    expect(() => addBreadcrumb('anything')).not.toThrow();
  });
});

describe('startPerfTrace / reportPerf — sampling and release metadata tagging', () => {
  it('logs a sampled trace with release metadata in dev', async () => {
    setActiveReportContext(
      buildReportContext({
        appVersion: '1.0.0',
        runtimeVersion: '1.0.0',
        releaseId: 'release-abc',
        schemaVersion: 1,
        platform: 'ios',
        appVariant: 'production',
        degraded: false,
      }),
    );

    const handle = await startPerfTrace('entity-load', { screen: 'EntityDetail' });
    expect(console.debug).toHaveBeenCalled();
    await handle.stop();
    expect(console.debug).toHaveBeenCalled();
  });

  it('never samples (skips console entirely) at a 0 sample rate', async () => {
    setObservabilityConfig({ observabilityEnabled: true, performanceSampleRate: 0 });
    const handle = await startPerfTrace('should-not-sample');
    await expect(handle.stop()).resolves.toBeUndefined();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('reportPerf still returns the wrapped function result and propagates its OWN error', async () => {
    await expect(reportPerf('ok-trace', () => 42)).resolves.toBe(42);
    await expect(
      reportPerf('failing-op', () => {
        throw new Error('the real operation failed');
      }),
    ).rejects.toThrow('the real operation failed');
  });

  it('reportPerf never throws due to console logging failures on stop', async () => {
    (console.debug as jest.Mock).mockImplementation(() => {
      throw new Error('console failed');
    });
    const handle = await startPerfTrace('flaky-trace');
    expect(() => handle.putAttribute('k', 'v')).not.toThrow();
    await expect(handle.stop()).resolves.toBeUndefined();
  });
});

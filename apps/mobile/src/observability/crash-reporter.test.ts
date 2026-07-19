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
import type {
  NativeCrashlyticsSurface,
  NativePerfSurface,
  NativePerfTrace,
} from './native-bridge';

function fakeCrashlytics(overrides: Partial<NativeCrashlyticsSurface> = {}): {
  instance: NativeCrashlyticsSurface;
  recordError: jest.Mock;
  log: jest.Mock;
  setAttributes: jest.Mock;
} {
  const recordError = jest.fn();
  const log = jest.fn();
  const setAttributes = jest.fn().mockResolvedValue(undefined);
  const instance: NativeCrashlyticsSurface = {
    recordError,
    log,
    setAttributes,
    setCrashlyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { instance, recordError, log, setAttributes };
}

function fakePerf(): { instance: NativePerfSurface; trace: NativePerfTrace } {
  const trace: NativePerfTrace = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    putAttribute: jest.fn(),
  };
  const instance: NativePerfSurface = {
    newTrace: jest.fn().mockReturnValue(trace),
    setPerformanceCollectionEnabled: jest.fn().mockResolvedValue(undefined),
  };
  return { instance, trace };
}

beforeEach(() => {
  __resetObservabilityForTests();
  setObservabilityConfig({ observabilityEnabled: true, performanceSampleRate: 1 });
});

afterEach(() => {
  __resetObservabilityForTests();
});

describe('reportError — graceful SDK failure (bead requirement 5)', () => {
  it('never throws when the native SDK is entirely absent (the default state in this sandbox/CI — the packages are not installed)', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('never throws when the injected native SDK throws synchronously from every method', () => {
    const { instance } = fakeCrashlytics({
      recordError: () => {
        throw new Error('native recordError exploded');
      },
      setAttributes: () => {
        throw new Error('native setAttributes exploded');
      },
    });
    expect(() =>
      reportError(new Error('boom'), { context: { note: 'safe' } }, { getCrashlytics: () => instance }),
    ).not.toThrow();
  });

  it('never throws when the injected native SDK loader itself throws', () => {
    expect(() =>
      reportError(new Error('boom'), undefined, {
        getCrashlytics: () => {
          throw new Error('loader exploded');
        },
      }),
    ).not.toThrow();
  });

  it('records a normalized error and does not throw for non-Error inputs', () => {
    const { instance, recordError } = fakeCrashlytics();
    const deps = { getCrashlytics: () => instance };

    expect(() => reportError('a plain string error', undefined, deps)).not.toThrow();
    expect(() => reportError({ some: 'object' }, undefined, deps)).not.toThrow();
    expect(() => reportError(undefined, undefined, deps)).not.toThrow();
    expect(() => reportError(null, undefined, deps)).not.toThrow();

    // Circular non-Error value must not infinite-loop or throw.
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => reportError(circular, undefined, deps)).not.toThrow();

    expect(recordError).toHaveBeenCalledTimes(5);
    for (const call of recordError.mock.calls) {
      expect(call[0]).toBeInstanceOf(Error);
    }
  });

  it('does nothing (no-op) and never touches the native SDK when observabilityEnabled is false', () => {
    setObservabilityConfig({ observabilityEnabled: false, performanceSampleRate: 1 });
    expect(getObservabilityConfig().observabilityEnabled).toBe(false);
    const { instance, recordError } = fakeCrashlytics();
    expect(() =>
      reportError(new Error('should be swallowed'), undefined, { getCrashlytics: () => instance }),
    ).not.toThrow();
    expect(recordError).not.toHaveBeenCalled();
  });
});

describe('reportError — redaction pipeline is mandatory (privacy invariant 7)', () => {
  // A realistic PII/sensitive corpus mirroring log-redaction.test.ts's own
  // categories: search query text, correction content, precise coordinates,
  // citation URLs, sensitive entity classifications, and a raw App Check
  // token. None of these may reach the (fake) native SDK unredacted.
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

  it('scrubs every sensitive category before the (fake) native setAttributes call', () => {
    const { instance, setAttributes } = fakeCrashlytics();

    reportError(new Error('view failed'), { context: SENSITIVE_CORPUS }, { getCrashlytics: () => instance });

    expect(setAttributes).toHaveBeenCalledTimes(1);
    const sentAttributes = setAttributes.mock.calls[0][0] as Record<string, string>;
    const serialized = JSON.stringify(sentAttributes);

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
    const { instance, setAttributes } = fakeCrashlytics();
    reportError(
      new Error('x'),
      {
        context: {
          debugField:
            'attaching token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
          innocuousNote: 'user was at 40.7128,-74.0060',
        },
      },
      { getCrashlytics: () => instance },
    );
    const sent = setAttributes.mock.calls[0][0] as Record<string, string>;
    expect(sent.debugField).toBe('[redacted]');
    expect(sent.innocuousNote).toBe('[redacted]');
  });

  it('scrubs a coordinate pattern embedded in an Error message/stack passed as context', () => {
    // Mirrors log-redaction.test.ts's own "scrubs sensitive values carried
    // inside an Error message/stack" case: free-text words alone ("Tulsa
    // massacre") are NOT content-scanned by `redactForLog` (it redacts by KEY
    // NAME and by VALUE PATTERN, not prose topic-matching — see
    // log-redaction.ts's header comment), but a lat/lng-shaped substring IS a
    // value pattern and triggers whole-message redaction.
    const { instance, setAttributes } = fakeCrashlytics();
    const err = new Error('request failed for query "Tulsa massacre" at 40.7128,-74.0060');
    reportError(new Error('outer'), { context: { originalError: err } }, { getCrashlytics: () => instance });
    const sent = JSON.stringify(setAttributes.mock.calls[0][0]);
    expect(sent).not.toContain('40.7128');
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
    // Must still be JSON-serializable (cycle was broken).
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
    const { instance, setAttributes } = fakeCrashlytics();
    const huge = { blob: 'y'.repeat(MAX_CONTEXT_SERIALIZED_BYTES * 8) };
    reportError(new Error('x'), { context: huge }, { getCrashlytics: () => instance });
    const sent = setAttributes.mock.calls[0][0] as Record<string, string>;
    // Attributes are stringified; whatever reaches the SDK must be bounded.
    expect(JSON.stringify(sent).length).toBeLessThan(MAX_CONTEXT_SERIALIZED_BYTES * 2);
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
    // `redactForLog` treats BigInt (and other non-JSON-safe primitives) as an
    // opaque/never-log type and replaces it with a placeholder, so this never
    // reaches JSON.stringify in its raw, unserializable form — but the
    // end-to-end path (redact -> stringify -> cap) must still never throw
    // even if a future value type slipped past that guard.
    const withBigInt = { count: BigInt(10) } as unknown as Record<string, unknown>;
    expect(() => redactAndCapContext(withBigInt)).not.toThrow();
  });
});

describe('addBreadcrumb', () => {
  // NOTE on scope: `message` is intended as a short, fixed, developer-authored
  // label (e.g. "entity-load-failed"), not a place to interpolate user data —
  // `log-redaction.ts` deliberately redacts free text only by VALUE PATTERN
  // (JWT shape, lat/lng pairs), not by scanning prose for topic words, so a
  // raw message string is bounded/length-capped here but not word-scrubbed.
  // Anything structured (query text, coordinates, URLs, classifications) must
  // go through the `data` parameter, which IS key-scanned — this mirrors how
  // `redactForLog` itself is documented and tested in log-redaction.test.ts.
  it('never throws and truncates an overlong message rather than sending it unbounded', () => {
    const { instance, log } = fakeCrashlytics();
    const deps = { getCrashlytics: () => instance };
    const longMessage = 'y'.repeat(5000);

    expect(() => addBreadcrumb(longMessage, undefined, deps)).not.toThrow();
    const sentLine = log.mock.calls[0][0] as string;
    expect(sentLine.length).toBeLessThanOrEqual(MAX_BREADCRUMB_MESSAGE_LENGTH + 60);
  });

  it('redacts sensitive fields carried in the structured `data` parameter', () => {
    const { instance, log } = fakeCrashlytics();
    const deps = { getCrashlytics: () => instance };

    expect(() =>
      addBreadcrumb('short message', { citationUrl: 'https://loc.gov/x' }, deps),
    ).not.toThrow();
    const sentLine = log.mock.calls[0][0] as string;
    expect(sentLine).not.toContain('loc.gov');

    // A JWT-shaped App Check token embedded directly in the message string IS
    // caught, because that is a VALUE pattern (not a topic-word match).
    log.mockClear();
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    addBreadcrumb(`token attached: ${jwt}`, undefined, deps);
    const sentLine2 = log.mock.calls[0][0] as string;
    expect(sentLine2).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('is a no-op and never touches the native SDK when observability is disabled', () => {
    setObservabilityConfig({ observabilityEnabled: false, performanceSampleRate: 1 });
    const { instance, log } = fakeCrashlytics();
    expect(() => addBreadcrumb('anything', undefined, { getCrashlytics: () => instance })).not.toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it('never throws when the native log() call itself throws', () => {
    const { instance } = fakeCrashlytics({
      log: () => {
        throw new Error('native log exploded');
      },
    });
    expect(() => addBreadcrumb('anything', undefined, { getCrashlytics: () => instance })).not.toThrow();
  });
});

describe('startPerfTrace / reportPerf — sampling and release metadata tagging', () => {
  it('attaches the active report context as attributes on a sampled trace', async () => {
    const { instance, trace } = fakePerf();
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

    const handle = await startPerfTrace('entity-load', { screen: 'EntityDetail' }, {
      getPerf: () => instance,
    });
    expect(instance.newTrace).toHaveBeenCalled();
    expect(trace.start).toHaveBeenCalled();
    // Every attached attribute is a plain string (Perf SDK requirement).
    const putCalls = (trace.putAttribute as jest.Mock).mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);
    const attrMap = Object.fromEntries(putCalls);
    expect(attrMap.releaseId).toBe('release-abc');
    expect(attrMap.appVersion).toBe('1.0.0');

    await handle.stop();
    expect(trace.stop).toHaveBeenCalled();
  });

  it('never samples (skips the native call entirely) at a 0 sample rate', async () => {
    setObservabilityConfig({ observabilityEnabled: true, performanceSampleRate: 0 });
    const { instance } = fakePerf();
    const handle = await startPerfTrace('should-not-sample', undefined, { getPerf: () => instance });
    expect(instance.newTrace).not.toHaveBeenCalled();
    await expect(handle.stop()).resolves.toBeUndefined();
  });

  it('is a true no-op when the native perf SDK is absent (never throws)', async () => {
    const handle = await startPerfTrace('no-sdk-trace');
    await expect(handle.stop()).resolves.toBeUndefined();
    expect(() => handle.putAttribute('k', 'v')).not.toThrow();
  });

  it('reportPerf still returns the wrapped function result and propagates its OWN error, even though instrumentation is defensive', async () => {
    await expect(reportPerf('ok-trace', () => 42)).resolves.toBe(42);
    await expect(
      reportPerf('failing-op', () => {
        throw new Error('the real operation failed');
      }),
    ).rejects.toThrow('the real operation failed');
  });

  it('reportPerf never throws due to the native SDK throwing on start/stop', async () => {
    const trace: NativePerfTrace = {
      start: jest.fn().mockRejectedValue(new Error('native start failed')),
      stop: jest.fn().mockRejectedValue(new Error('native stop failed')),
      putAttribute: jest.fn(() => {
        throw new Error('native putAttribute failed');
      }),
    };
    const instance: NativePerfSurface = {
      newTrace: jest.fn().mockReturnValue(trace),
      setPerformanceCollectionEnabled: jest.fn().mockResolvedValue(undefined),
    };
    const handle = await startPerfTrace('flaky-trace', undefined, { getPerf: () => instance });
    expect(() => handle.putAttribute('k', 'v')).not.toThrow();
    await expect(handle.stop()).resolves.toBeUndefined();
  });
});

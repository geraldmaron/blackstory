import {
  resolveObservabilityConfig,
  shouldSamplePerfTrace,
  DEFAULT_OBSERVABILITY_ENABLED,
  DEFAULT_PERFORMANCE_SAMPLE_RATE,
} from './config';

describe('resolveObservabilityConfig — kill switch (MOB-018 item 7)', () => {
  it('defaults to enabled with the documented default sample rate when extra is absent', () => {
    const config = resolveObservabilityConfig(undefined);
    expect(config.observabilityEnabled).toBe(DEFAULT_OBSERVABILITY_ENABLED);
    expect(config.observabilityEnabled).toBe(true);
    expect(config.performanceSampleRate).toBe(DEFAULT_PERFORMANCE_SAMPLE_RATE);
  });

  it('only an explicit false disables observability — any other falsy/garbage value stays on', () => {
    expect(resolveObservabilityConfig({ observabilityEnabled: false }).observabilityEnabled).toBe(false);
    expect(resolveObservabilityConfig({ observabilityEnabled: 0 }).observabilityEnabled).toBe(true);
    expect(resolveObservabilityConfig({ observabilityEnabled: 'no' }).observabilityEnabled).toBe(true);
    expect(resolveObservabilityConfig({ observabilityEnabled: null }).observabilityEnabled).toBe(true);
  });

  it('accepts an explicit true', () => {
    expect(resolveObservabilityConfig({ observabilityEnabled: true }).observabilityEnabled).toBe(true);
  });

  it('never throws on a malformed extra value', () => {
    expect(() => resolveObservabilityConfig(null)).not.toThrow();
    expect(() => resolveObservabilityConfig('not-an-object')).not.toThrow();
    expect(() => resolveObservabilityConfig(42)).not.toThrow();
    expect(() => resolveObservabilityConfig([1, 2, 3])).not.toThrow();
  });

  it('clamps an out-of-range or non-numeric sample rate to the default', () => {
    expect(resolveObservabilityConfig({ performanceSampleRate: 1.5 }).performanceSampleRate).toBe(
      DEFAULT_PERFORMANCE_SAMPLE_RATE,
    );
    expect(resolveObservabilityConfig({ performanceSampleRate: -0.1 }).performanceSampleRate).toBe(
      DEFAULT_PERFORMANCE_SAMPLE_RATE,
    );
    expect(resolveObservabilityConfig({ performanceSampleRate: 'half' }).performanceSampleRate).toBe(
      DEFAULT_PERFORMANCE_SAMPLE_RATE,
    );
    expect(resolveObservabilityConfig({ performanceSampleRate: Number.NaN }).performanceSampleRate).toBe(
      DEFAULT_PERFORMANCE_SAMPLE_RATE,
    );
  });

  it('accepts a valid custom sample rate in [0, 1]', () => {
    expect(resolveObservabilityConfig({ performanceSampleRate: 0.5 }).performanceSampleRate).toBe(0.5);
    expect(resolveObservabilityConfig({ performanceSampleRate: 0 }).performanceSampleRate).toBe(0);
    expect(resolveObservabilityConfig({ performanceSampleRate: 1 }).performanceSampleRate).toBe(1);
  });
});

describe('shouldSamplePerfTrace', () => {
  it('never samples at rate 0, regardless of the random draw', () => {
    expect(shouldSamplePerfTrace(0, () => 0)).toBe(false);
    expect(shouldSamplePerfTrace(0, () => 0.9999)).toBe(false);
  });

  it('always samples at rate 1, regardless of the random draw', () => {
    expect(shouldSamplePerfTrace(1, () => 0.9999)).toBe(true);
    expect(shouldSamplePerfTrace(1, () => 0)).toBe(true);
  });

  it('samples deterministically against an injected random source', () => {
    expect(shouldSamplePerfTrace(0.1, () => 0.05)).toBe(true);
    expect(shouldSamplePerfTrace(0.1, () => 0.5)).toBe(false);
  });

  it('treats a negative or non-finite rate as never-sample rather than throwing', () => {
    expect(shouldSamplePerfTrace(-1, () => 0)).toBe(false);
    expect(shouldSamplePerfTrace(Number.NaN, () => 0)).toBe(false);
  });
});

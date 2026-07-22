import {
  buildReportContext,
  resolveRuntimeVersion,
  reportContextToAttributes,
} from './report-context';

describe('buildReportContext (MOB-018 item 3)', () => {
  it('assembles every required field from resolved inputs', () => {
    const context = buildReportContext({
      appVersion: '1.2.0',
      buildNumber: '42',
      runtimeVersion: '1.2.0',
      releaseId: 'release-2026-07-19',
      schemaVersion: 1,
      platform: 'ios',
      platformVersion: '16.4',
      appVariant: 'production',
      degraded: false,
    });

    expect(context).toEqual({
      appVersion: '1.2.0',
      buildNumber: '42',
      runtimeVersion: '1.2.0',
      releaseId: 'release-2026-07-19',
      schemaVersion: 1,
      platform: 'ios',
      platformVersion: '16.4',
      appVariant: 'production',
      degraded: false,
    });
  });

  it('falls back to stable "unknown" placeholders rather than throwing or omitting keys', () => {
    const context = buildReportContext({ schemaVersion: 1, degraded: true });

    expect(context.appVersion).toBe('unknown');
    expect(context.buildNumber).toBe('unknown');
    expect(context.runtimeVersion).toBe('unknown');
    expect(context.releaseId).toBe('unknown');
    expect(context.platform).toBe('unknown');
    expect(context.platformVersion).toBe('unknown');
    expect(context.appVariant).toBe('development');
    expect(context.degraded).toBe(true);
    expect(context.schemaVersion).toBe(1);
    // Every key is always present, even when unresolved.
    expect(Object.keys(context).sort()).toEqual(
      [
        'appVariant',
        'appVersion',
        'buildNumber',
        'degraded',
        'platform',
        'platformVersion',
        'releaseId',
        'runtimeVersion',
        'schemaVersion',
      ].sort(),
    );
  });

  it('treats an empty-string input the same as an absent one', () => {
    const context = buildReportContext({
      appVersion: '',
      releaseId: '',
      schemaVersion: 1,
      degraded: false,
    });
    expect(context.appVersion).toBe('unknown');
    expect(context.releaseId).toBe('unknown');
  });

  it('normalizes a non-finite schemaVersion to a sentinel rather than NaN', () => {
    const context = buildReportContext({
      schemaVersion: Number.NaN,
      degraded: false,
    });
    expect(context.schemaVersion).toBe(-1);
  });
});

describe('resolveRuntimeVersion (ADR-023 §2)', () => {
  it('prefers an explicit runtimeVersion string from config', () => {
    expect(resolveRuntimeVersion('1.2.0', '9.9.9')).toBe('1.2.0');
  });

  it('falls back to the app version when config value is a policy object, not a string', () => {
    expect(resolveRuntimeVersion({ policy: 'appVersion' }, '1.2.0')).toBe('1.2.0');
  });

  it('falls back to the app version when config value is absent', () => {
    expect(resolveRuntimeVersion(undefined, '1.2.0')).toBe('1.2.0');
  });

  it('returns undefined when neither is available (buildReportContext then uses "unknown")', () => {
    expect(resolveRuntimeVersion(undefined, undefined)).toBeUndefined();
  });
});

describe('reportContextToAttributes', () => {
  it('flattens every field to a string, safe for Crashlytics setAttributes / Perf putAttribute', () => {
    const context = buildReportContext({
      appVersion: '1.0.0',
      schemaVersion: 3,
      degraded: true,
    });
    const attrs = reportContextToAttributes(context);
    for (const value of Object.values(attrs)) {
      expect(typeof value).toBe('string');
    }
    expect(attrs.schemaVersion).toBe('3');
    expect(attrs.degraded).toBe('true');
  });
});

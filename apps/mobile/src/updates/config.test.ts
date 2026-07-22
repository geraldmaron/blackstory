import { resolveUpdatesPosture, updatesPostureToAttributes, CODE_SIGNING_POSTURE } from './config';

describe('resolveUpdatesPosture — pre-EAS-project human gate (repo-ovn7)', () => {
  it('resolves to disabled/null with the fixed accepted-risk label when the native module is absent', () => {
    const posture = resolveUpdatesPosture(null);
    expect(posture).toEqual({
      enabled: false,
      channel: null,
      runtimeVersion: null,
      updateId: null,
      codeSigningPosture: CODE_SIGNING_POSTURE,
    });
  });

  it('never throws on a null native input', () => {
    expect(() => resolveUpdatesPosture(null)).not.toThrow();
  });

  it('passes through the real native values once expo-updates is enabled', () => {
    const posture = resolveUpdatesPosture({
      isEnabled: true,
      channel: 'production',
      runtimeVersion: '1.2.0',
      updateId: 'a1b2c3',
    });
    expect(posture.enabled).toBe(true);
    expect(posture.channel).toBe('production');
    expect(posture.runtimeVersion).toBe('1.2.0');
    expect(posture.updateId).toBe('a1b2c3');
    expect(posture.codeSigningPosture).toBe('free-tier-accepted-risk');
  });

  it('reports isEnabled=false verbatim even when channel/runtimeVersion are present (e.g. dev client)', () => {
    const posture = resolveUpdatesPosture({
      isEnabled: false,
      channel: 'development',
      runtimeVersion: '1.2.0',
      updateId: null,
    });
    expect(posture.enabled).toBe(false);
  });
});

describe('updatesPostureToAttributes', () => {
  it('maps null fields to stable unknown/embedded placeholders, never undefined', () => {
    const attributes = updatesPostureToAttributes(resolveUpdatesPosture(null));
    expect(attributes).toEqual({
      otaEnabled: 'false',
      otaChannel: 'unknown',
      otaRuntimeVersion: 'unknown',
      otaUpdateId: 'embedded',
      otaCodeSigningPosture: 'free-tier-accepted-risk',
    });
  });

  it('carries real values through unmodified', () => {
    const attributes = updatesPostureToAttributes(
      resolveUpdatesPosture({
        isEnabled: true,
        channel: 'preview',
        runtimeVersion: '1.0.0',
        updateId: 'deadbeef',
      }),
    );
    expect(attributes.otaEnabled).toBe('true');
    expect(attributes.otaChannel).toBe('preview');
    expect(attributes.otaRuntimeVersion).toBe('1.0.0');
    expect(attributes.otaUpdateId).toBe('deadbeef');
  });
});

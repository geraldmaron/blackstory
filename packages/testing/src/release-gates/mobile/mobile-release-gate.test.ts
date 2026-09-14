/**
 * Mobile store release gate: every machine check is exercised against a passing baseline and at
 * least one way of breaking it, plus the parsers that read the generated native project.
 *
 * The baseline is built here rather than loaded from a fixture of the current tree on purpose: a
 * fixture captured from today's repository would bake today's defects into the expected result,
 * and the gate would go green the day someone regenerated it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { MOBILE_RELEASE_GATES, REQUIRED_HUMAN_RELEASE_GATE_IDS } from './criteria.js';
import { evaluateMobileReleaseGate, missingReleaseAttestations } from './evaluate.js';
import { runMobileReleaseCheck } from './checks.js';
import {
  parseAaptBadging,
  parseGradleProperties,
  parseReleaseBuildSettings,
  parseTargetBuildPhases,
} from './collect.js';
import type { HumanAttestationBundle, MobileReleaseEvidence } from './types.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const SHA = 'a'.repeat(40);

function baseline(): MobileReleaseEvidence {
  return {
    schemaVersion: 1,
    collectedAt: '2026-09-13T00:00:00.000Z',
    collectedBy: 'test',
    variant: 'production',
    envFilesPresent: [],
    expected: {
      bundleIdentifier: 'app.blackstory.mobile',
      displayName: 'BlackStory',
      version: '1.0.0',
      iosDeploymentTarget: '16.4',
      androidMinSdkVersion: 26,
      apiBaseUrl: 'https://api.blackstory.app',
      associatedDomain: 'blackstory.app',
      easProjectId: '51a35884-e6b5-43b6-b95b-c5a7460fa665',
      runtimeVersionPolicy: 'appVersion',
    },
    commit: { sha: SHA, branch: 'staging', clean: true, dirtyPaths: [] },
    eas: {
      source: 'apps/mobile/eas.json',
      appVersionSource: 'remote',
      codeSigningCertificate: 'certs/updates.pem',
      appleTeamId: '4Q2XU7D33G',
      profiles: {
        development: {
          channel: 'development',
          distribution: 'internal',
          projectId: '51a35884-e6b5-43b6-b95b-c5a7460fa665',
          apiBaseUrl: null,
          appVariant: 'development',
        },
        production: {
          channel: 'production',
          distribution: 'store',
          projectId: '51a35884-e6b5-43b6-b95b-c5a7460fa665',
          apiBaseUrl: 'https://api.blackstory.app',
          appVariant: 'production',
        },
      },
    },
    ios: {
      source: 'apps/mobile/ios',
      projectName: 'BlackStory',
      releaseBuildSettings: {
        INFOPLIST_FILE: 'BlackStory/Info.plist',
        PRODUCT_BUNDLE_IDENTIFIER: 'app.blackstory.mobile',
        IPHONEOS_DEPLOYMENT_TARGET: '16.4',
        TARGETED_DEVICE_FAMILY: '"1,2"',
      },
      targetBuildPhases: ['[Expo Dev Launcher] Strip Local Network Keys for Release'],
      infoPlist: {
        CFBundleDisplayName: 'BlackStory',
        CFBundleShortVersionString: '1.0.0',
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {},
        NSLocalNetworkUsageDescription: 'Expo Dev Launcher uses the local network.',
      },
      expoPlist: {
        EXUpdatesURL: 'https://u.expo.dev/51a35884-e6b5-43b6-b95b-c5a7460fa665',
        EXUpdatesRuntimeVersion: '1.0.0',
        EXUpdatesEnabled: true,
        EXUpdatesCodeSigningCertificate: '-----BEGIN CERTIFICATE-----',
      },
      entitlements: { 'com.apple.developer.associated-domains': ['applinks:blackstory.app'] },
      privacyManifestPresent: true,
    },
    android: {
      source: 'apps/mobile/android',
      gradle: {
        command: './gradlew :app:properties',
        compileSdkVersion: 36,
        targetSdkVersion: 36,
        minSdkVersion: 26,
      },
      apk: {
        command: 'aapt2 dump badging app-release.apk',
        path: 'app/build/outputs/apk/release/app-release.apk',
        packageName: 'app.blackstory.mobile',
        versionName: '1.0.0',
        targetSdkVersion: 36,
        compileSdkVersion: 36,
      },
    },
  };
}

/** Applies one mutation to a deep-cloned baseline. */
function broken(mutate: (evidence: MobileReleaseEvidence) => void): MobileReleaseEvidence {
  const clone = structuredClone(baseline()) as MobileReleaseEvidence;
  mutate(clone);
  return clone;
}

const MACHINE_GATE_IDS = MOBILE_RELEASE_GATES.filter((gate) => gate.kind === 'machine').map(
  (gate) => gate.id,
);

test('the baseline passes every machine gate', () => {
  const evidence = baseline();
  for (const gateId of MACHINE_GATE_IDS) {
    const result = runMobileReleaseCheck(gateId, evidence);
    assert.equal(result.pass, true, `${gateId}: ${result.pass ? '' : result.message}`);
  }
});

test('a missing platform fails rather than skipping', () => {
  const noIos = broken((evidence) => {
    delete (evidence as { ios?: unknown }).ios;
  });
  const iosGates = MACHINE_GATE_IDS.filter((id) => id.startsWith('ios-') || id.startsWith('ota-'));
  for (const gateId of iosGates) {
    assert.equal(runMobileReleaseCheck(gateId, noIos).pass, false, gateId);
  }
  const noAndroid = broken((evidence) => {
    delete (evidence as { android?: unknown }).android;
  });
  assert.equal(runMobileReleaseCheck('android-target-sdk', noAndroid).pass, false);
});

test('build provenance refuses a short SHA, a dirty tree, and a local dotenv', () => {
  const short = broken((evidence) => {
    (evidence.commit as { sha: string }).sha = 'abc1234';
  });
  assert.equal(runMobileReleaseCheck('build-provenance', short).pass, false);

  const dirty = broken((evidence) => {
    Object.assign(evidence.commit, { clean: false, dirtyPaths: ['apps/mobile/app.config.ts'] });
  });
  const result = runMobileReleaseCheck('build-provenance', dirty);
  assert.equal(result.pass, false);
  assert.match(result.pass ? '' : result.message, /apps\/mobile\/app\.config\.ts/);

  // `expo config` reads dotenv files, so one on the build host silently moves the expectation
  // the generated artifacts are compared against.
  const localEnv = broken((evidence) => {
    (evidence as { envFilesPresent: string[] }).envFilesPresent = ['.env.local'];
  });
  const envResult = runMobileReleaseCheck('build-provenance', localEnv);
  assert.equal(envResult.pass, false);
  assert.match(envResult.pass ? '' : envResult.message, /\.env\.local/);
});

test('iOS identity is read from the generated project, not the expectation', () => {
  const wrongBundle = broken((evidence) => {
    (
      evidence.ios as { releaseBuildSettings: Record<string, string> }
    ).releaseBuildSettings.PRODUCT_BUNDLE_IDENTIFIER = 'app.blackbook.mobile';
  });
  const result = runMobileReleaseCheck('ios-bundle-identity', wrongBundle);
  assert.equal(result.pass, false);
  assert.match(result.pass ? '' : result.message, /app\.blackbook\.mobile/);

  const wrongVersion = broken((evidence) => {
    (evidence.ios as { infoPlist: Record<string, unknown> }).infoPlist.CFBundleShortVersionString =
      '0.9.0';
  });
  assert.equal(runMobileReleaseCheck('ios-bundle-identity', wrongVersion).pass, false);
});

test('an iPhone-only device family fails, because the tablet layout could never be reached', () => {
  const phoneOnly = broken((evidence) => {
    (
      evidence.ios as { releaseBuildSettings: Record<string, string> }
    ).releaseBuildSettings.TARGETED_DEVICE_FAMILY = '"1"';
  });
  assert.equal(runMobileReleaseCheck('ios-os-floor-and-devices', phoneOnly).pass, false);
});

test('store compliance catches each declaration independently', () => {
  const cases: readonly [string, (evidence: MobileReleaseEvidence) => void][] = [
    [
      'missing export compliance',
      (evidence) => {
        delete (evidence.ios as { infoPlist: Record<string, unknown> }).infoPlist
          .ITSAppUsesNonExemptEncryption;
      },
    ],
    [
      'arbitrary loads',
      (evidence) => {
        (evidence.ios as { infoPlist: Record<string, unknown> }).infoPlist.NSAppTransportSecurity =
          {
            NSAllowsArbitraryLoads: true,
          };
      },
    ],
    [
      'local networking in production',
      (evidence) => {
        (evidence.ios as { infoPlist: Record<string, unknown> }).infoPlist.NSAppTransportSecurity =
          {
            NSAllowsLocalNetworking: true,
          };
      },
    ],
    [
      'no privacy manifest',
      (evidence) => {
        (evidence.ios as { privacyManifestPresent: boolean }).privacyManifestPresent = false;
      },
    ],
    [
      'empty permission string',
      (evidence) => {
        (
          evidence.ios as { infoPlist: Record<string, unknown> }
        ).infoPlist.NSCameraUsageDescription = '   ';
      },
    ],
    [
      'dev keys with no strip phase',
      (evidence) => {
        (evidence.ios as { targetBuildPhases: string[] }).targetBuildPhases = ['[CP] Copy Pods'];
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    assert.equal(runMobileReleaseCheck('ios-store-compliance', broken(mutate)).pass, false, name);
  }
});

test('associated domains are required for production and irrelevant elsewhere', () => {
  const missing = broken((evidence) => {
    (evidence.ios as { entitlements: Record<string, unknown> }).entitlements = {};
  });
  assert.equal(runMobileReleaseCheck('ios-associated-domains', missing).pass, false);

  const development = broken((evidence) => {
    (evidence as { variant: string }).variant = 'development';
    (evidence.ios as { entitlements: Record<string, unknown> }).entitlements = {};
  });
  assert.equal(runMobileReleaseCheck('ios-associated-domains', development).pass, true);
});

test('an OTA runtime version that drifts from the app version fails', () => {
  const drifted = broken((evidence) => {
    (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist.EXUpdatesRuntimeVersion =
      '0.9.0';
  });
  const result = runMobileReleaseCheck('ota-runtime-version', drifted);
  assert.equal(result.pass, false);
  assert.match(result.pass ? '' : result.message, /0\.9\.0/);

  const wrongPolicy = broken((evidence) => {
    (evidence.expected as { runtimeVersionPolicy: string }).runtimeVersionPolicy = 'sdkVersion';
  });
  assert.equal(runMobileReleaseCheck('ota-runtime-version', wrongPolicy).pass, false);
});

test('channel and environment are cross-checked between eas.json and the artifact', () => {
  const cases: readonly [string, (evidence: MobileReleaseEvidence) => void][] = [
    [
      'update URL points at another project',
      (evidence) => {
        (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist.EXUpdatesURL =
          'https://u.expo.dev/00000000-0000-0000-0000-000000000000';
      },
    ],
    [
      'production is an internal distribution',
      (evidence) => {
        (evidence.eas.profiles.production as { distribution: string }).distribution = 'internal';
      },
    ],
    [
      'production points at a cleartext API',
      (evidence) => {
        (evidence.eas.profiles.production as { apiBaseUrl: string }).apiBaseUrl =
          'http://api.blackstory.app';
      },
    ],
    [
      'production points at the wrong https host',
      (evidence) => {
        (evidence.eas.profiles.production as { apiBaseUrl: string }).apiBaseUrl =
          'https://staging.blackstory.app';
      },
    ],
    [
      'production ships with the updater off',
      (evidence) => {
        (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist.EXUpdatesEnabled = false;
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    assert.equal(
      runMobileReleaseCheck('ota-channel-environment', broken(mutate)).pass,
      false,
      name,
    );
  }
});

test('a development collection does not judge the production host against its own expectation', () => {
  // Regression: the production-profile host check used `expected.apiBaseUrl`, which for a
  // development collection is the development API origin, so a correct repository failed.
  const development = broken((evidence) => {
    (evidence as { variant: string }).variant = 'development';
    (evidence.expected as { apiBaseUrl: string }).apiBaseUrl = 'http://127.0.0.1:8080';
    (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist.EXUpdatesEnabled = false;
  });
  assert.equal(runMobileReleaseCheck('ota-channel-environment', development).pass, true);
});

test('a development build with the updater enabled fails, because it fights Metro', () => {
  const enabled = broken((evidence) => {
    (evidence as { variant: string }).variant = 'development';
    (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist.EXUpdatesEnabled = true;
  });
  assert.equal(runMobileReleaseCheck('ota-channel-environment', enabled).pass, false);
});

test('unsigned OTA fails, and a certificate the binary cannot see fails too', () => {
  const unsigned = broken((evidence) => {
    (evidence.eas as { codeSigningCertificate: string | null }).codeSigningCertificate = null;
  });
  const result = runMobileReleaseCheck('ota-code-signing', unsigned);
  assert.equal(result.pass, false);
  assert.match(result.pass ? '' : result.message, /repo-3en3s/);

  const notEmbedded = broken((evidence) => {
    delete (evidence.ios as { expoPlist: Record<string, unknown> }).expoPlist
      .EXUpdatesCodeSigningCertificate;
  });
  assert.equal(runMobileReleaseCheck('ota-code-signing', notEmbedded).pass, false);
});

test('Android target API is proven from Gradle AND the artifact', () => {
  const below = broken((evidence) => {
    (evidence.android as { gradle: { targetSdkVersion: number } }).gradle.targetSdkVersion = 35;
  });
  assert.equal(runMobileReleaseCheck('android-target-sdk', below).pass, false);

  const noArtifact = broken((evidence) => {
    delete (evidence.android as { apk?: unknown }).apk;
  });
  const result = runMobileReleaseCheck('android-target-sdk', noArtifact);
  assert.equal(result.pass, false);
  assert.match(result.pass ? '' : result.message, /artifact/i);

  const disagree = broken((evidence) => {
    (evidence.android as { apk: { targetSdkVersion: number } }).apk.targetSdkVersion = 34;
  });
  assert.equal(runMobileReleaseCheck('android-target-sdk', disagree).pass, false);
});

// --- decision -----------------------------------------------------------------

function attestAll(at = '2026-09-13'): HumanAttestationBundle {
  return {
    schemaVersion: 1,
    attestations: REQUIRED_HUMAN_RELEASE_GATE_IDS.map((gateId) => ({
      gateId,
      attestedBy: 'Gerald Dagher',
      attestedAt: at,
    })),
  };
}

test('a perfect bundle with no attestations is NO_GO', () => {
  const report = evaluateMobileReleaseGate({
    evidence: baseline(),
    evaluator: 'test',
    evaluatedAt: '2026-09-13T12:00:00.000Z',
  });
  assert.equal(report.decision, 'NO_GO');
  assert.equal(report.requiredFailed, REQUIRED_HUMAN_RELEASE_GATE_IDS.length);
  assert.deepEqual(missingReleaseAttestations(undefined), REQUIRED_HUMAN_RELEASE_GATE_IDS);
});

test('a perfect bundle with every attestation is GO', () => {
  const report = evaluateMobileReleaseGate({
    evidence: baseline(),
    evaluator: 'test',
    evaluatedAt: '2026-09-13T12:00:00.000Z',
    attestations: attestAll(),
  });
  assert.equal(
    report.decision,
    'GO',
    JSON.stringify(report.gates.filter((g) => g.status === 'fail')),
  );
  assert.equal(report.requiredFailed, 0);
  assert.equal(report.commitSha, SHA);
});

test('a placeholder signature does not attest anything', () => {
  const report = evaluateMobileReleaseGate({
    evidence: baseline(),
    evaluator: 'test',
    evaluatedAt: '2026-09-13T12:00:00.000Z',
    attestations: {
      schemaVersion: 1,
      attestations: REQUIRED_HUMAN_RELEASE_GATE_IDS.map((gateId) => ({
        gateId,
        attestedBy: 'TODO',
        attestedAt: '2026-09-13',
      })),
    },
  });
  assert.equal(report.decision, 'NO_GO');
});

test('the code-signing gate is optional by decision, and still reported', () => {
  // `docs/mobile/release/store-account-checklist.md` accepts the unsigned-OTA risk while the
  // project is on the EAS free tier. The gate stays in the inventory and stays red so the
  // accepted risk is restated on every release; it just does not block one.
  const definition = MOBILE_RELEASE_GATES.find((gate) => gate.id === 'ota-code-signing');
  assert.ok(definition, 'ota-code-signing must stay in the inventory');
  assert.equal(definition.required, false);

  const unsigned = broken((evidence) => {
    (evidence.eas as { codeSigningCertificate: string | null }).codeSigningCertificate = null;
  });
  const report = evaluateMobileReleaseGate({
    evidence: unsigned,
    evaluator: 'test',
    evaluatedAt: '2026-09-13T12:00:00.000Z',
    attestations: attestAll(),
  });
  assert.equal(report.decision, 'GO');
  assert.equal(report.optionalFailed, 1);
  assert.equal(
    report.gates.find((gate) => gate.id === 'ota-code-signing')?.status,
    'fail',
    'an accepted risk is still reported as a failure',
  );
});

test('every gate definition has a checker or is a human gate', () => {
  for (const gate of MOBILE_RELEASE_GATES) {
    if (gate.kind !== 'machine') continue;
    const result = runMobileReleaseCheck(gate.id, baseline());
    assert.notEqual(
      result.pass === false && /No machine checker registered/.test(result.message),
      true,
      `${gate.id} has no checker`,
    );
  }
});

// --- parsers ------------------------------------------------------------------

test('the pbxproj parser reads the app target Release settings, not the project or Pods', () => {
  const pbxproj = readFileSync(join(fixturesDir, 'project.pbxproj.sample'), 'utf8');
  const settings = parseReleaseBuildSettings(pbxproj);
  assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER, 'app.blackstory.mobile');
  assert.equal(settings.IPHONEOS_DEPLOYMENT_TARGET, '16.4');
  assert.equal(settings.TARGETED_DEVICE_FAMILY, '"1,2"');
  // The project-level Release block declares a different deployment target and no Info.plist.
  assert.notEqual(settings.IPHONEOS_DEPLOYMENT_TARGET, '15.1');
  // Multi-line values are skipped rather than half-parsed.
  assert.equal(settings.OTHER_LDFLAGS, undefined);
});

test('the pbxproj parser lists the application target build phases in order', () => {
  const pbxproj = readFileSync(join(fixturesDir, 'project.pbxproj.sample'), 'utf8');
  const phases = parseTargetBuildPhases(pbxproj);
  assert.deepEqual(phases, [
    'Sources',
    'Resources',
    'Bundle React Native code and images',
    '[Expo Dev Launcher] Strip Local Network Keys for Release',
  ]);
});

test('Gradle and aapt2 output parse into numbers, and absence into null', () => {
  const gradle = parseGradleProperties(
    ['compileSdkVersion: 36', 'targetSdkVersion: 36', 'minSdkVersion: 26'].join('\n'),
  );
  assert.deepEqual(gradle, { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 26 });
  assert.deepEqual(parseGradleProperties('BUILD SUCCESSFUL'), {
    compileSdkVersion: null,
    targetSdkVersion: null,
    minSdkVersion: null,
  });

  const badging = parseAaptBadging(
    "package: name='app.blackstory.mobile' versionCode='1' versionName='1.0.0' compileSdkVersion='36'\n" +
      "targetSdkVersion:'36'",
  );
  assert.equal(badging.packageName, 'app.blackstory.mobile');
  assert.equal(badging.targetSdkVersion, 36);
  assert.equal(badging.compileSdkVersion, 36);
});

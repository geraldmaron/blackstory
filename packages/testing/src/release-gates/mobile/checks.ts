/**
 * Machine checks for the mobile store release gate.
 *
 * Every function here is pure: evidence in, verdict out, no filesystem and no child processes.
 * That is what lets the whole gate be exercised from fixtures on a machine with no Xcode, and it
 * is why `collect.ts` carries all the platform knowledge instead.
 *
 * A missing platform is a FAILURE, never a skip. "We could not look" and "we looked and it was
 * fine" are the two states a release gate exists to keep apart.
 */
import type { MachineCheckResult } from '../../launch-gate/evidence-checks.js';
import type { AndroidEvidence, IosEvidence, MobileReleaseEvidence, PlistValue } from './types.js';
import { ANDROID_REQUIRED_TARGET_SDK } from './types.js';

export type { MachineCheckResult };

const FULL_SHA = /^[0-9a-f]{40}$/;
const USAGE_DESCRIPTION_KEY = /^NS[A-Za-z]+UsageDescription$/;

function fail(message: string): MachineCheckResult {
  return { pass: false, message };
}

const PASS: MachineCheckResult = { pass: true };

function firstFailure(results: readonly MachineCheckResult[]): MachineCheckResult {
  for (const result of results) {
    if (!result.pass) return result;
  }
  return PASS;
}

function plistString(plist: PlistValue, key: string): string | undefined {
  const value = plist[key];
  return typeof value === 'string' ? value : undefined;
}

function plistArray(plist: PlistValue, key: string): readonly unknown[] | undefined {
  const value = plist[key];
  return Array.isArray(value) ? value : undefined;
}

/** Xcode writes list-valued settings quoted; `"1,2"` and `1,2` mean the same thing. */
function unquote(value: string): string {
  return value.replace(/^"(.*)"$/, '$1');
}

function requireIos(evidence: MobileReleaseEvidence): IosEvidence | MachineCheckResult {
  if (evidence.ios === undefined) {
    return fail(
      'No iOS evidence in the bundle — run the collector on a macOS host after `expo prebuild`.',
    );
  }
  return evidence.ios;
}

function isIos(value: IosEvidence | MachineCheckResult): value is IosEvidence {
  return !('pass' in value);
}

export function checkBuildProvenance(evidence: MobileReleaseEvidence): MachineCheckResult {
  const { sha, clean, dirtyPaths } = evidence.commit;
  if (!FULL_SHA.test(sha)) {
    return fail(`Commit SHA is not a full 40-character git SHA (got "${sha}").`);
  }
  if (!clean) {
    const shown = dirtyPaths.slice(0, 5).join(', ');
    const more = dirtyPaths.length > 5 ? ` (+${dirtyPaths.length - 5} more)` : '';
    return fail(
      `Working tree was modified when the artifacts were collected, so this build cannot be reproduced from ${sha}: ${shown}${more}`,
    );
  }
  if (evidence.envFilesPresent.length > 0) {
    return fail(
      `Local environment files were loaded while resolving the expected identity (${evidence.envFilesPresent.join(', ')}), so the artifacts were compared against this machine rather than against the release configuration.`,
    );
  }
  return PASS;
}

export function checkIosBundleIdentity(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  const bundleId = ios.releaseBuildSettings.PRODUCT_BUNDLE_IDENTIFIER;
  const expected = evidence.expected;
  if (bundleId === undefined) {
    return fail('Release build configuration declares no PRODUCT_BUNDLE_IDENTIFIER.');
  }
  if (unquote(bundleId) !== expected.bundleIdentifier) {
    return fail(
      `Release bundle id is "${unquote(bundleId)}", expected "${expected.bundleIdentifier}" for the ${evidence.variant} variant.`,
    );
  }

  const displayName = plistString(ios.infoPlist, 'CFBundleDisplayName');
  if (displayName !== expected.displayName) {
    return fail(
      `CFBundleDisplayName is "${displayName ?? '(absent)'}", expected "${expected.displayName}".`,
    );
  }

  const version = plistString(ios.infoPlist, 'CFBundleShortVersionString');
  if (version !== expected.version) {
    return fail(
      `CFBundleShortVersionString is "${version ?? '(absent)'}", expected "${expected.version}".`,
    );
  }

  return PASS;
}

export function checkIosOsFloorAndDevices(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  const target = ios.releaseBuildSettings.IPHONEOS_DEPLOYMENT_TARGET;
  if (target === undefined) {
    return fail('Release build configuration declares no IPHONEOS_DEPLOYMENT_TARGET.');
  }
  if (unquote(target) !== evidence.expected.iosDeploymentTarget) {
    return fail(
      `IPHONEOS_DEPLOYMENT_TARGET is ${unquote(target)}, expected ${evidence.expected.iosDeploymentTarget}.`,
    );
  }

  const family = ios.releaseBuildSettings.TARGETED_DEVICE_FAMILY;
  if (family === undefined) {
    return fail('Release build configuration declares no TARGETED_DEVICE_FAMILY.');
  }
  const families = unquote(family)
    .split(',')
    .map((entry) => entry.trim());
  if (!families.includes('2')) {
    return fail(
      `TARGETED_DEVICE_FAMILY is "${unquote(family)}" — iPad (2) is missing, so the tablet layout can never be reached.`,
    );
  }

  return PASS;
}

/**
 * Development keys the Expo dev launcher injects, which must not survive into a store binary.
 * They are present in the GENERATED plist by design and removed at build time by a Release build
 * phase, so the gate asserts the phase rather than the absence of the keys.
 */
const DEV_LAUNCHER_KEYS = ['NSLocalNetworkUsageDescription', 'NSBonjourServices'] as const;
const STRIP_PHASE_MARKER = /strip local network keys/i;

export function checkIosStoreCompliance(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  return firstFailure([
    checkExportCompliance(ios),
    checkAppTransportSecurity(evidence, ios),
    checkPrivacyManifest(ios),
    checkUsageDescriptions(ios),
    checkDevKeyStrip(ios),
  ]);
}

function checkExportCompliance(ios: IosEvidence): MachineCheckResult {
  const declared = ios.infoPlist.ITSAppUsesNonExemptEncryption;
  if (declared === undefined) {
    return fail(
      'Info.plist declares no ITSAppUsesNonExemptEncryption, so every upload stops on the export-compliance questionnaire.',
    );
  }
  if (declared !== false) {
    return fail(
      `ITSAppUsesNonExemptEncryption is ${String(declared)} — the app claims non-exempt encryption it does not use.`,
    );
  }
  return PASS;
}

function checkAppTransportSecurity(
  evidence: MobileReleaseEvidence,
  ios: IosEvidence,
): MachineCheckResult {
  const ats = ios.infoPlist.NSAppTransportSecurity;
  if (ats === undefined) return PASS;
  if (typeof ats !== 'object' || ats === null) {
    return fail('NSAppTransportSecurity is present but is not a dictionary.');
  }
  const settings = ats as Record<string, unknown>;
  if (settings.NSAllowsArbitraryLoads === true) {
    return fail('NSAllowsArbitraryLoads is true — the binary permits cleartext traffic anywhere.');
  }
  if (evidence.variant === 'production' && settings.NSAllowsLocalNetworking === true) {
    return fail(
      'NSAllowsLocalNetworking is true in a production build — that exemption exists for a LAN dev server.',
    );
  }
  return PASS;
}

function checkPrivacyManifest(ios: IosEvidence): MachineCheckResult {
  if (!ios.privacyManifestPresent) {
    return fail('PrivacyInfo.xcprivacy is missing — App Store Connect rejects the upload.');
  }
  return PASS;
}

/**
 * A permission string that is present but empty crashes the app the first time iOS asks for that
 * permission, and nothing in the build catches it.
 */
function checkUsageDescriptions(ios: IosEvidence): MachineCheckResult {
  for (const [key, value] of Object.entries(ios.infoPlist)) {
    if (!USAGE_DESCRIPTION_KEY.test(key)) continue;
    if (typeof value !== 'string' || value.trim() === '') {
      return fail(`${key} is declared but empty — iOS terminates the app when it asks.`);
    }
  }
  return PASS;
}

function checkDevKeyStrip(ios: IosEvidence): MachineCheckResult {
  const present = DEV_LAUNCHER_KEYS.filter((key) => ios.infoPlist[key] !== undefined);
  if (present.length === 0) return PASS;
  const stripped = ios.targetBuildPhases.some((phase) => STRIP_PHASE_MARKER.test(phase));
  if (!stripped) {
    return fail(
      `The generated Info.plist carries dev-launcher keys (${present.join(', ')}) and the Release configuration has no build phase that strips them.`,
    );
  }
  return PASS;
}

const ASSOCIATED_DOMAINS_KEY = 'com.apple.developer.associated-domains';

export function checkIosAssociatedDomains(evidence: MobileReleaseEvidence): MachineCheckResult {
  if (evidence.variant !== 'production') return PASS;
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  const domains = plistArray(ios.entitlements, ASSOCIATED_DOMAINS_KEY);
  const wanted = `applinks:${evidence.expected.associatedDomain}`;
  if (domains === undefined) {
    return fail(
      `Entitlements declare no ${ASSOCIATED_DOMAINS_KEY} — universal links to ${evidence.expected.associatedDomain} open in the browser instead of the app.`,
    );
  }
  if (!domains.includes(wanted)) {
    return fail(`Associated domains do not include "${wanted}" (got ${JSON.stringify(domains)}).`);
  }
  return PASS;
}

export function checkOtaRuntimeVersion(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  if (evidence.expected.runtimeVersionPolicy !== 'appVersion') {
    return fail(
      `Runtime version policy is "${evidence.expected.runtimeVersionPolicy}" — under anything but appVersion a native-affecting change need not bump the fence.`,
    );
  }
  const runtime = plistString(ios.expoPlist, 'EXUpdatesRuntimeVersion');
  if (runtime !== evidence.expected.version) {
    return fail(
      `EXUpdatesRuntimeVersion is "${runtime ?? '(absent)'}", expected "${evidence.expected.version}" — an update could install onto a binary it was not built for.`,
    );
  }
  return PASS;
}

export function checkOtaChannelEnvironment(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  const expectedUrl = `https://u.expo.dev/${evidence.expected.easProjectId}`;
  const url = plistString(ios.expoPlist, 'EXUpdatesURL');
  if (url !== expectedUrl) {
    return fail(`EXUpdatesURL is "${url ?? '(absent)'}", expected "${expectedUrl}".`);
  }

  const mismatched = Object.entries(evidence.eas.profiles).filter(
    ([, profile]) =>
      profile.projectId !== null && profile.projectId !== evidence.expected.easProjectId,
  );
  if (mismatched.length > 0) {
    return fail(
      `EAS profiles point at a different project id: ${mismatched.map(([name]) => name).join(', ')}.`,
    );
  }

  const production = evidence.eas.profiles.production;
  if (production === undefined) {
    return fail('eas.json declares no production build profile.');
  }
  if (production.distribution !== 'store') {
    return fail(
      `Production profile distribution is "${production.distribution ?? '(absent)'}", expected "store".`,
    );
  }
  if (production.channel !== 'production') {
    return fail(
      `Production profile channel is "${production.channel ?? '(absent)'}", expected "production".`,
    );
  }
  const productionApi = production.apiBaseUrl;
  if (productionApi === null || !productionApi.startsWith('https://')) {
    return fail(
      `Production profile API_BASE_URL is "${productionApi ?? '(absent)'}" — a store build must be pinned to an https origin.`,
    );
  }
  // The exact host is only comparable when this bundle IS the production build. A development
  // collection resolves `expected` for the development variant, and asserting the production
  // profile against it would fail on a correct repository.
  if (evidence.variant === 'production' && productionApi !== evidence.expected.apiBaseUrl) {
    return fail(
      `Production profile API_BASE_URL is "${productionApi}", expected "${evidence.expected.apiBaseUrl}".`,
    );
  }

  const updatesEnabled = ios.expoPlist.EXUpdatesEnabled;
  if (evidence.variant === 'development') {
    if (updatesEnabled !== false) {
      return fail(
        'A development build ships with the native updater enabled — it will fight Metro on launch.',
      );
    }
  } else if (updatesEnabled !== true) {
    return fail(
      `EXUpdatesEnabled is ${String(updatesEnabled)} in a ${evidence.variant} build — shipped updates would never install.`,
    );
  }

  return PASS;
}

export function checkOtaCodeSigning(evidence: MobileReleaseEvidence): MachineCheckResult {
  const ios = requireIos(evidence);
  if (!isIos(ios)) return ios;

  if (evidence.eas.codeSigningCertificate === null) {
    return fail(
      'eas.json declares no updates.codeSigningCertificate, so every OTA bundle is trusted on TLS to the update host alone (repo-3en3s).',
    );
  }
  if (plistString(ios.expoPlist, 'EXUpdatesCodeSigningCertificate') === undefined) {
    return fail(
      'eas.json declares a code-signing certificate but the generated Expo.plist carries no EXUpdatesCodeSigningCertificate — the binary would not verify it.',
    );
  }
  return PASS;
}

export function checkAndroidTargetSdk(evidence: MobileReleaseEvidence): MachineCheckResult {
  const android: AndroidEvidence | undefined = evidence.android;
  if (android === undefined) {
    return fail(
      'No Android evidence in the bundle — run the collector with a JDK and the Android SDK available so `./gradlew :app:properties` can run.',
    );
  }

  const { compileSdkVersion, targetSdkVersion, minSdkVersion } = android.gradle;
  if (targetSdkVersion === null || compileSdkVersion === null) {
    return fail(
      `Gradle reported no ${targetSdkVersion === null ? 'targetSdkVersion' : 'compileSdkVersion'} — the values were not read from a real invocation of \`${android.gradle.command}\`.`,
    );
  }
  if (targetSdkVersion < ANDROID_REQUIRED_TARGET_SDK) {
    return fail(
      `Gradle targetSdkVersion is ${targetSdkVersion}; Google Play requires ${ANDROID_REQUIRED_TARGET_SDK} or higher.`,
    );
  }
  if (compileSdkVersion < ANDROID_REQUIRED_TARGET_SDK) {
    return fail(
      `Gradle compileSdkVersion is ${compileSdkVersion}, below targetSdk ${ANDROID_REQUIRED_TARGET_SDK}.`,
    );
  }
  if (minSdkVersion !== null && minSdkVersion !== evidence.expected.androidMinSdkVersion) {
    return fail(
      `Gradle minSdkVersion is ${minSdkVersion}, expected ${evidence.expected.androidMinSdkVersion}.`,
    );
  }

  const apk = android.apk;
  if (apk === undefined) {
    return fail(
      'Gradle values are present but no release artifact was inspected. The program requires the target proven from the built artifact too, not from the build configuration alone.',
    );
  }
  if (apk.targetSdkVersion !== targetSdkVersion) {
    return fail(
      `The built artifact targets API ${apk.targetSdkVersion ?? '(unreadable)'} while Gradle reports ${targetSdkVersion} — the artifact is not the configuration.`,
    );
  }
  return PASS;
}

const MACHINE_CHECKS: Readonly<
  Record<string, (evidence: MobileReleaseEvidence) => MachineCheckResult>
> = {
  'build-provenance': checkBuildProvenance,
  'ios-bundle-identity': checkIosBundleIdentity,
  'ios-os-floor-and-devices': checkIosOsFloorAndDevices,
  'ios-store-compliance': checkIosStoreCompliance,
  'ios-associated-domains': checkIosAssociatedDomains,
  'ota-runtime-version': checkOtaRuntimeVersion,
  'ota-channel-environment': checkOtaChannelEnvironment,
  'ota-code-signing': checkOtaCodeSigning,
  'android-target-sdk': checkAndroidTargetSdk,
};

export function runMobileReleaseCheck(
  gateId: string,
  evidence: MobileReleaseEvidence,
): MachineCheckResult {
  const checker = MACHINE_CHECKS[gateId];
  if (checker === undefined) {
    return fail(`No machine checker registered for ${gateId}.`);
  }
  return checker(evidence);
}

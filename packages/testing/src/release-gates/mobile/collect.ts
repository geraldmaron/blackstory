/**
 * Collector for the mobile release gate: turns a build host into an evidence bundle.
 *
 * Everything platform-specific lives here — plutil, project.pbxproj, Gradle, aapt2 — so that
 * `checks.ts` stays pure and the whole gate can be exercised from fixtures on a machine with no
 * Xcode. Nothing in this file judges: it records what it found, including what it could not find,
 * and lets the evaluator decide.
 *
 * The expected identity is read by evaluating app.config.ts through `expo config`. That is still
 * config — but it is used only as the DECLARED INTENT the generated artifacts are compared
 * against. The gate's rule is artifact-equals-intent; neither half alone is evidence.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AndroidApkEvidence,
  AndroidEvidence,
  AndroidGradleEvidence,
  AppVariant,
  CommitEvidence,
  EasEvidence,
  EasProfileEvidence,
  ExpectedIdentity,
  IosEvidence,
  MobileReleaseEvidence,
  PlistValue,
} from './types.js';
import { MOBILE_RELEASE_EVIDENCE_SCHEMA_VERSION } from './types.js';

const MOBILE_APP_DIR = 'apps/mobile';
const DIRTY_PATH_LIMIT = 25;

/**
 * Dotenv files Expo loads when resolving app.config.ts. `.env.example` is not one of them.
 * Order matches Expo's own precedence; only presence matters here.
 */
const DOTENV_FILES = ['.env', '.env.local', '.env.development', '.env.production'] as const;

export function collectEnvFilesPresent(repoRoot: string): readonly string[] {
  const appDir = join(repoRoot, MOBILE_APP_DIR);
  return DOTENV_FILES.filter((name) => existsSync(join(appDir, name)));
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(env !== undefined ? { env } : {}),
  });
}

export function collectCommitEvidence(repoRoot: string): CommitEvidence {
  const sha = run('git', ['rev-parse', 'HEAD'], repoRoot).trim();
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot).trim();
  const porcelain = run('git', ['status', '--porcelain'], repoRoot).trim();
  const dirtyPaths =
    porcelain === ''
      ? []
      : porcelain
          .split('\n')
          .map((line) => line.slice(3).trim())
          .slice(0, DIRTY_PATH_LIMIT);
  return { sha, branch, clean: dirtyPaths.length === 0, dirtyPaths };
}

// --- Expected identity -------------------------------------------------------

interface ResolvedExpoConfig {
  readonly name?: string;
  readonly version?: string;
  readonly runtimeVersion?: { readonly policy?: string } | string;
  readonly ios?: {
    readonly bundleIdentifier?: string;
    readonly deploymentTarget?: string;
    readonly associatedDomains?: readonly string[];
  };
  readonly plugins?: readonly unknown[];
  readonly extra?: {
    readonly apiBaseUrl?: string;
    readonly eas?: { readonly projectId?: string };
  };
}

/** Pulls `expo-build-properties`' android.minSdkVersion out of the resolved plugin list. */
function minSdkFromPlugins(plugins: readonly unknown[] | undefined): number {
  for (const entry of plugins ?? []) {
    if (!Array.isArray(entry) || entry[0] !== 'expo-build-properties') continue;
    const props = entry[1] as { android?: { minSdkVersion?: number } } | undefined;
    const value = props?.android?.minSdkVersion;
    if (typeof value === 'number') return value;
  }
  return 0;
}

function associatedDomainHost(domains: readonly string[] | undefined): string {
  const applink = (domains ?? []).find((entry) => entry.startsWith('applinks:'));
  return applink === undefined ? '' : applink.slice('applinks:'.length);
}

export function collectExpectedIdentity(repoRoot: string, variant: AppVariant): ExpectedIdentity {
  const appDir = join(repoRoot, MOBILE_APP_DIR);
  const raw = run(
    'npx',
    ['--no-install', 'expo', 'config', '--json', '--type', 'prebuild'],
    appDir,
    {
      ...process.env,
      APP_VARIANT: variant,
    },
  );
  // `expo config` prefixes human-readable lines before the JSON on some SDK versions.
  const start = raw.indexOf('{');
  const config = JSON.parse(raw.slice(start)) as ResolvedExpoConfig;
  const runtimeVersion = config.runtimeVersion;
  return {
    bundleIdentifier: config.ios?.bundleIdentifier ?? '',
    displayName: config.name ?? '',
    version: config.version ?? '',
    iosDeploymentTarget: config.ios?.deploymentTarget ?? '',
    androidMinSdkVersion: minSdkFromPlugins(config.plugins),
    apiBaseUrl: config.extra?.apiBaseUrl ?? '',
    associatedDomain: associatedDomainHost(config.ios?.associatedDomains),
    easProjectId: config.extra?.eas?.projectId ?? '',
    runtimeVersionPolicy:
      typeof runtimeVersion === 'object' ? (runtimeVersion?.policy ?? '') : (runtimeVersion ?? ''),
  };
}

// --- iOS ---------------------------------------------------------------------

function plistToJson(path: string): PlistValue {
  const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', path], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(json) as PlistValue;
}

const XC_BUILD_CONFIG_BLOCK =
  /[0-9A-F]{24} \/\* (\w+) \*\/ = \{\s*isa = XCBuildConfiguration;([\s\S]*?)\n\t\t\};/g;
const BUILD_SETTINGS_BLOCK = /buildSettings = \{\n([\s\S]*?)\n\t{3}\};/;
const SETTING_LINE = /^\t{4}([A-Za-z0-9_]+) = (.+);$/;

/**
 * Reads the app target's Release build settings out of project.pbxproj.
 *
 * The app target's configuration is the one carrying INFOPLIST_FILE; the other Release blocks in
 * the file belong to the project and to Pods targets and would answer with the wrong values.
 * Multi-line values (arrays like OTHER_LDFLAGS) are skipped — no gate reads one, and half-parsing
 * them would put a truncated string where a reader expects a setting.
 */
export function parseReleaseBuildSettings(pbxproj: string): Readonly<Record<string, string>> {
  for (const match of pbxproj.matchAll(XC_BUILD_CONFIG_BLOCK)) {
    const [, name = '', body = ''] = match;
    if (name !== 'Release') continue;
    const settingsMatch = BUILD_SETTINGS_BLOCK.exec(body);
    if (settingsMatch === null) continue;
    const settings: Record<string, string> = {};
    for (const line of (settingsMatch[1] ?? '').split('\n')) {
      const setting = SETTING_LINE.exec(line);
      if (setting === null) continue;
      const [, key = '', value = ''] = setting;
      if (value.startsWith('(')) continue;
      settings[key] = value;
    }
    if (settings.INFOPLIST_FILE !== undefined) return settings;
  }
  return {};
}

const APP_TARGET_BLOCK =
  /isa = PBXNativeTarget;([\s\S]*?)productType = "com\.apple\.product-type\.application";/;
const BUILD_PHASES_LIST = /buildPhases = \(\n([\s\S]*?)\n\t{3}\);/;
const PHASE_NAME = /\/\* (.+?) \*\//;

/** Names of the application target's build phases, in order. */
export function parseTargetBuildPhases(pbxproj: string): readonly string[] {
  const target = APP_TARGET_BLOCK.exec(pbxproj);
  if (target === null) return [];
  const list = BUILD_PHASES_LIST.exec(target[1] ?? '');
  if (list === null) return [];
  const names: string[] = [];
  for (const line of (list[1] ?? '').split('\n')) {
    const name = PHASE_NAME.exec(line);
    if (name !== null && name[1] !== undefined) names.push(name[1]);
  }
  return names;
}

/** Returns undefined when the host has no generated iOS tree or cannot read plists. */
export function collectIosEvidence(repoRoot: string): IosEvidence | undefined {
  const iosDir = join(repoRoot, MOBILE_APP_DIR, 'ios');
  if (!existsSync(iosDir)) return undefined;
  const projectDir = readdirSync(iosDir).find((entry) => entry.endsWith('.xcodeproj'));
  if (projectDir === undefined) return undefined;
  const projectName = projectDir.replace(/\.xcodeproj$/, '');
  const pbxprojPath = join(iosDir, projectDir, 'project.pbxproj');
  const appDir = join(iosDir, projectName);
  const infoPlistPath = join(appDir, 'Info.plist');
  const expoPlistPath = join(appDir, 'Supporting', 'Expo.plist');
  const entitlementsPath = join(appDir, `${projectName}.entitlements`);
  if (!existsSync(pbxprojPath) || !existsSync(infoPlistPath)) return undefined;

  const pbxproj = readFileSync(pbxprojPath, 'utf8');
  return {
    source: `${MOBILE_APP_DIR}/ios`,
    projectName,
    releaseBuildSettings: parseReleaseBuildSettings(pbxproj),
    targetBuildPhases: parseTargetBuildPhases(pbxproj),
    infoPlist: plistToJson(infoPlistPath),
    expoPlist: existsSync(expoPlistPath) ? plistToJson(expoPlistPath) : {},
    entitlements: existsSync(entitlementsPath) ? plistToJson(entitlementsPath) : {},
    privacyManifestPresent: existsSync(join(appDir, 'PrivacyInfo.xcprivacy')),
  };
}

// --- EAS ---------------------------------------------------------------------

interface RawEasJson {
  readonly cli?: { readonly appVersionSource?: string };
  readonly build?: Readonly<
    Record<
      string,
      {
        readonly channel?: string;
        readonly distribution?: string;
        readonly env?: Readonly<Record<string, string>>;
      }
    >
  >;
  readonly updates?: { readonly codeSigningCertificate?: string };
  readonly submit?: { readonly production?: { readonly ios?: { readonly appleTeamId?: string } } };
}

export function collectEasEvidence(repoRoot: string): EasEvidence {
  const source = `${MOBILE_APP_DIR}/eas.json`;
  const raw = JSON.parse(readFileSync(join(repoRoot, source), 'utf8')) as RawEasJson;
  const profiles: Record<string, EasProfileEvidence> = {};
  for (const [name, profile] of Object.entries(raw.build ?? {})) {
    profiles[name] = {
      channel: profile.channel ?? null,
      distribution: profile.distribution ?? null,
      projectId: profile.env?.EAS_PROJECT_ID ?? null,
      apiBaseUrl: profile.env?.API_BASE_URL ?? null,
      appVariant: profile.env?.APP_VARIANT ?? null,
    };
  }
  return {
    source,
    appVersionSource: raw.cli?.appVersionSource ?? null,
    codeSigningCertificate: raw.updates?.codeSigningCertificate ?? null,
    profiles,
    appleTeamId: raw.submit?.production?.ios?.appleTeamId ?? null,
  };
}

// --- Android -----------------------------------------------------------------

function parseIntOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchOne(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1];
}

export function parseGradleProperties(stdout: string): Omit<AndroidGradleEvidence, 'command'> {
  return {
    compileSdkVersion: parseIntOrNull(matchOne(stdout, /^compileSdkVersion: (\d+)$/m)),
    targetSdkVersion: parseIntOrNull(matchOne(stdout, /^targetSdkVersion: (\d+)$/m)),
    minSdkVersion: parseIntOrNull(matchOne(stdout, /^minSdkVersion: (\d+)$/m)),
  };
}

export function parseAaptBadging(stdout: string): Omit<AndroidApkEvidence, 'command' | 'path'> {
  return {
    packageName: matchOne(stdout, /package: name='([^']+)'/) ?? null,
    versionName: matchOne(stdout, /versionName='([^']+)'/) ?? null,
    targetSdkVersion: parseIntOrNull(matchOne(stdout, /targetSdkVersion:'(\d+)'/)),
    compileSdkVersion: parseIntOrNull(matchOne(stdout, /compileSdkVersion='(\d+)'/)),
  };
}

export interface AndroidCollectionOptions {
  /** Reuse an already-captured `./gradlew :app:properties` stdout instead of running Gradle. */
  readonly gradleOutputPath?: string;
  /**
   * Reuse already-captured `aapt2 dump badging` stdout instead of inspecting an artifact here.
   *
   * This is how CI hands the Android facts to the macOS job that owns the decision: the 167MB
   * APK stays on the Linux runner and only its badging travels.
   */
  readonly aaptOutputPath?: string;
  /** Release artifact to inspect with aapt2. Defaults to the standard assembleRelease output. */
  readonly apkPath?: string;
  readonly androidHome?: string;
  readonly javaHome?: string;
}

function findAapt2(androidHome: string): string | undefined {
  const buildTools = join(androidHome, 'build-tools');
  if (!existsSync(buildTools)) return undefined;
  const versions = readdirSync(buildTools).sort().reverse();
  for (const version of versions) {
    const candidate = join(buildTools, version, 'aapt2');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Returns undefined when the host cannot produce Android evidence at all. The caller records the
 * absence; the gate fails on it rather than passing quietly.
 */
export function collectAndroidEvidence(
  repoRoot: string,
  options: AndroidCollectionOptions = {},
): AndroidEvidence | undefined {
  const androidDir = join(repoRoot, MOBILE_APP_DIR, 'android');
  // A captured Gradle run is evidence wherever it was produced; the generated tree only has to
  // be here when this host is the one that runs Gradle.
  if (!existsSync(androidDir) && options.gradleOutputPath === undefined) return undefined;

  const gradleCommand = './gradlew :app:properties';
  let gradleStdout: string;
  if (options.gradleOutputPath !== undefined) {
    gradleStdout = readFileSync(options.gradleOutputPath, 'utf8');
  } else {
    const androidHome = options.androidHome ?? process.env.ANDROID_HOME ?? '';
    const javaHome = options.javaHome ?? process.env.JAVA_HOME ?? '';
    if (javaHome === '' || androidHome === '') return undefined;
    try {
      gradleStdout = run('./gradlew', [':app:properties', '--console=plain', '-q'], androidDir, {
        ...process.env,
        JAVA_HOME: javaHome,
        ANDROID_HOME: androidHome,
      });
    } catch {
      return undefined;
    }
  }

  const gradle: AndroidGradleEvidence = {
    command: gradleCommand,
    ...parseGradleProperties(gradleStdout),
  };

  const defaultApkPath = join(androidDir, 'app/build/outputs/apk/release/app-release.apk');
  const apkPath = options.apkPath ?? defaultApkPath;

  if (options.aaptOutputPath !== undefined) {
    const badging = readFileSync(options.aaptOutputPath, 'utf8');
    return {
      source: `${MOBILE_APP_DIR}/android`,
      gradle,
      apk: {
        command: `aapt2 dump badging ${apkPath}`,
        path: apkPath,
        ...parseAaptBadging(badging),
      },
    };
  }

  const androidHome = options.androidHome ?? process.env.ANDROID_HOME ?? '';
  const aapt2 = androidHome === '' ? undefined : findAapt2(androidHome);
  if (!existsSync(apkPath) || aapt2 === undefined) {
    return { source: `${MOBILE_APP_DIR}/android`, gradle };
  }

  const badging = run(aapt2, ['dump', 'badging', apkPath], androidDir);
  const apk: AndroidApkEvidence = {
    command: `aapt2 dump badging ${apkPath}`,
    path: apkPath,
    ...parseAaptBadging(badging),
  };
  return { source: `${MOBILE_APP_DIR}/android`, gradle, apk };
}

// --- Bundle ------------------------------------------------------------------

export interface CollectionOptions {
  readonly repoRoot: string;
  readonly variant: AppVariant;
  readonly collectedBy: string;
  readonly collectedAt?: string;
  readonly android?: AndroidCollectionOptions | false;
}

export function collectMobileReleaseEvidence(options: CollectionOptions): MobileReleaseEvidence {
  const { repoRoot, variant } = options;
  const ios = collectIosEvidence(repoRoot);
  const android =
    options.android === false ? undefined : collectAndroidEvidence(repoRoot, options.android ?? {});
  return {
    schemaVersion: MOBILE_RELEASE_EVIDENCE_SCHEMA_VERSION,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    collectedBy: options.collectedBy,
    variant,
    envFilesPresent: collectEnvFilesPresent(repoRoot),
    expected: collectExpectedIdentity(repoRoot, variant),
    commit: collectCommitEvidence(repoRoot),
    eas: collectEasEvidence(repoRoot),
    ...(ios !== undefined ? { ios } : {}),
    ...(android !== undefined ? { android } : {}),
  };
}

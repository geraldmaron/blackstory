/**
 * Contracts for the mobile store release gate.
 *
 * WHY A SEPARATE EVIDENCE BUNDLE. The release program's rule for this wave is "config alone is
 * not evidence": target SDK is proven from a real Gradle run and a built artifact, never inferred
 * from an Expo version, and the iOS facts are read out of what `expo prebuild` GENERATED rather
 * than out of `app.config.ts`. Those artifacts are gitignored and need macOS, Xcode, a JDK and
 * the Android SDK to exist at all, so collection and judgement are split: `collect.ts` runs on a
 * host that has them and writes this bundle; `evaluate.ts` is pure and runs anywhere, including
 * against the fixtures in `fixtures/`. A gate whose logic can only be exercised on a build host
 * is a gate nobody tests.
 *
 * The gate vocabulary itself (definition, result, evidence pointer, GO/NO_GO) is deliberately the
 * beta launch gate's, imported rather than restated, so the repository has one evidence language
 * for release decisions instead of two that drift.
 */
import type {
  EvidencePointer,
  HumanAttestationBundle,
  LaunchDecision,
  LaunchGateDefinition,
  LaunchGateResult,
} from '../../launch-gate/types.js';

export type { EvidencePointer, HumanAttestationBundle, LaunchDecision, LaunchGateResult };

export const MOBILE_RELEASE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const MOBILE_RELEASE_DECISION_SCHEMA_VERSION = 1 as const;

export type AppVariant = 'development' | 'preview' | 'production';

/** A plist decoded to JSON. Values are whatever `plutil -convert json` produced. */
export type PlistValue = Readonly<Record<string, unknown>>;

/**
 * The commit the native artifacts were generated from.
 *
 * `clean` means no tracked modifications at collection time. A release gate that passes on a
 * dirty tree is attesting to something nobody can reproduce.
 */
export interface CommitEvidence {
  readonly sha: string;
  readonly branch: string;
  readonly clean: boolean;
  /** Paths reported by `git status --porcelain`, capped; empty when clean. */
  readonly dirtyPaths: readonly string[];
}

export interface IosEvidence {
  /** Repo-relative path of the generated tree these facts were read from. */
  readonly source: string;
  /** Xcode project / target name, e.g. `BlackStory`. */
  readonly projectName: string;
  /** Resolved build settings of the app target's Release configuration, from project.pbxproj. */
  readonly releaseBuildSettings: Readonly<Record<string, string>>;
  /**
   * Names of the app target's build phases, used to prove the dev-key strip runs. Xcode build
   * phases belong to the target, not to a configuration; the strip phase itself branches on
   * $CONFIGURATION internally, which is why its presence is what the gate can assert.
   */
  readonly targetBuildPhases: readonly string[];
  readonly infoPlist: PlistValue;
  readonly expoPlist: PlistValue;
  readonly entitlements: PlistValue;
  readonly privacyManifestPresent: boolean;
}

export interface AndroidGradleEvidence {
  /** The command whose stdout these values were parsed from. */
  readonly command: string;
  readonly compileSdkVersion: number | null;
  readonly targetSdkVersion: number | null;
  readonly minSdkVersion: number | null;
}

export interface AndroidApkEvidence {
  readonly command: string;
  readonly path: string;
  readonly packageName: string | null;
  readonly versionName: string | null;
  readonly targetSdkVersion: number | null;
  readonly compileSdkVersion: number | null;
}

export interface AndroidEvidence {
  readonly source: string;
  readonly gradle: AndroidGradleEvidence;
  /** Absent when no release artifact was built during collection. */
  readonly apk?: AndroidApkEvidence;
}

/** One EAS build profile, as declared in eas.json. */
export interface EasProfileEvidence {
  readonly channel: string | null;
  readonly distribution: string | null;
  readonly projectId: string | null;
  readonly apiBaseUrl: string | null;
  readonly appVariant: string | null;
}

export interface EasEvidence {
  readonly source: string;
  readonly appVersionSource: string | null;
  /** Present only when eas.json declares an `updates.codeSigningCertificate`. */
  readonly codeSigningCertificate: string | null;
  readonly profiles: Readonly<Record<string, EasProfileEvidence>>;
  readonly appleTeamId: string | null;
}

/** Values the gate compares the generated artifacts against, read from app.config.ts inputs. */
export interface ExpectedIdentity {
  readonly bundleIdentifier: string;
  readonly displayName: string;
  readonly version: string;
  readonly iosDeploymentTarget: string;
  readonly androidMinSdkVersion: number;
  readonly apiBaseUrl: string;
  readonly associatedDomain: string;
  readonly easProjectId: string;
  readonly runtimeVersionPolicy: string;
}

/** Minimum Android target API the store requires of a new release. */
export const ANDROID_REQUIRED_TARGET_SDK = 36 as const;

/**
 * Wave 9 mobile performance baseline (owner decision, 2026-09-14: REPORT-ONLY, no thresholds).
 * Shape written by `scripts/release/mobile-perf-baseline.mjs`; mirrors that script's output
 * exactly rather than re-deriving it, so the two do not drift independently.
 */
export interface MobilePerformanceMetricSample {
  readonly samples: readonly number[];
  readonly median: number | null;
  readonly p90?: number | null;
  readonly unit: string;
  readonly method: string;
}

export interface MobilePerformanceUnmeasuredEntry {
  readonly metric: string;
  readonly reason: string;
}

/**
 * Every metric the release program names for this wave. Mirrors the harness's own
 * `PROGRAM_METRICS` (`scripts/release/mobile-perf-baseline.mjs`) — kept as a second literal list
 * rather than a shared import because the harness is a standalone `.mjs` script with no
 * dependency on this package, the same boundary `checks.ts`'s comment about collection vs.
 * judgement draws elsewhere in this gate.
 */
export const MOBILE_PERFORMANCE_PROGRAM_METRICS = [
  'cold_launch',
  'warm_launch',
  'first_useful_content',
  'first_map_render',
  'map_interaction_jank',
  'record_search',
  'records_scroll',
  'story_load',
  'entity_detail',
  'image_decode',
  'sheet_interaction',
  'tablet_split',
  'memory',
  'bundle_size',
  'payload_cache',
] as const;

export type MobilePerformanceProgramMetric = (typeof MOBILE_PERFORMANCE_PROGRAM_METRICS)[number];

export interface MobilePerformanceBaseline {
  readonly schemaVersion: number;
  readonly commit?: string;
  readonly collectedAt?: string;
  readonly host?: string;
  readonly platform: 'ios' | 'android';
  /** Every sample in this bundle came from a simulator/emulator, never a physical device. */
  readonly environment: 'simulator' | 'emulator';
  readonly device?: string;
  readonly buildVariant?: string;
  readonly metrics: Readonly<Record<string, MobilePerformanceMetricSample>>;
  readonly unmeasured: readonly MobilePerformanceUnmeasuredEntry[];
  readonly note?: string;
}

export interface MobileReleaseEvidence {
  readonly schemaVersion: typeof MOBILE_RELEASE_EVIDENCE_SCHEMA_VERSION;
  readonly collectedAt: string;
  readonly collectedBy: string;
  readonly variant: AppVariant;
  /**
   * Dotenv files present in the mobile app directory when the expectation was resolved.
   *
   * `expo config` loads these, so a developer's `.env.local` can move the identity the generated
   * artifacts are compared against. A store-release collection has to run without them or the
   * comparison is against whatever happened to be on that machine.
   */
  readonly envFilesPresent: readonly string[];
  readonly expected: ExpectedIdentity;
  readonly commit: CommitEvidence;
  readonly eas: EasEvidence;
  /** Absent when the collecting host could not produce a native iOS tree. */
  readonly ios?: IosEvidence;
  /** Absent when the collecting host had no JDK or Android SDK. */
  readonly android?: AndroidEvidence;
  /**
   * Zero or more performance-baseline bundles (one per platform run of
   * `scripts/release/mobile-perf-baseline.mjs`), passed to `collect` via repeated
   * `--performance <file>` flags. Absent or empty when no baseline was collected for this
   * release — the gate that reads this (`mobile-performance-baseline`) fails on that, but as an
   * OPTIONAL gate, since the wave's owner decision is report-only with no launch dependency on it.
   */
  readonly performance?: readonly MobilePerformanceBaseline[];
}

export interface MobileReleaseEvaluationInput {
  readonly evidence: MobileReleaseEvidence;
  readonly evaluator: string;
  readonly evaluatedAt?: string;
  readonly attestations?: HumanAttestationBundle;
}

export interface MobileReleaseDecisionReport {
  readonly schemaVersion: typeof MOBILE_RELEASE_DECISION_SCHEMA_VERSION;
  readonly evaluator: string;
  readonly evaluatedAt: string;
  readonly variant: AppVariant;
  readonly commitSha: string;
  readonly decision: LaunchDecision;
  readonly requiredPassed: number;
  readonly requiredFailed: number;
  readonly optionalFailed: number;
  readonly gates: readonly LaunchGateResult[];
}

export type MobileReleaseGateDefinition = LaunchGateDefinition;

#!/usr/bin/env node
/**
 * Bundle/binary size baseline measurement (MOB-018 item 8).
 *
 * Runs `expo export` for a platform into a throwaway temp directory, measures
 * the resulting Metro/Hermes JS bundle plus the total exported asset payload
 * (fonts, images — everything `expo export` writes for that platform), and
 * reports the real numbers. This script IS the measurement mechanism the
 * bead asks for; it also updates `bundle-size-baseline.json` when run with
 * `--record`, which is the recorded reference point future PRs compare
 * against.
 *
 * Wiring this into an actual CI gate that FAILS a PR on regression is
 * MOB-019's job (quality gates / CI), not this bead's — this script only
 * measures and records a baseline number, it does not enforce one.
 *
 * Usage:
 *   pnpm --filter @repo/mobile bundle-size                       # measure iOS, print only
 *   pnpm --filter @repo/mobile bundle-size --record               # measure iOS, update baseline file
 *   pnpm --filter @repo/mobile bundle-size --platform android --record
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Platform = 'ios' | 'android';

const MOBILE_ROOT = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'bundle-size-baseline.json');

interface BundleSizeMeasurement {
  readonly platform: Platform;
  readonly measuredAt: string;
  readonly expoSdk: string;
  readonly jsBundleBytes: number;
  readonly totalExportBytes: number;
  readonly assetCount: number;
}

interface ExpoExportMetadata {
  readonly fileMetadata: Record<Platform, { bundle: string; assets: readonly unknown[] }>;
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : statSync(full).size;
  }
  return total;
}

function readExpoSdkVersion(): string {
  const pkg = JSON.parse(readFileSync(join(MOBILE_ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  return pkg.dependencies.expo ?? 'unknown';
}

function measure(platform: Platform): BundleSizeMeasurement {
  const outDir = mkdtempSync(join(tmpdir(), `mobile-bundle-size-${platform}-`));
  try {
    execFileSync('npx', ['expo', 'export', '--platform', platform, '--output-dir', outDir], {
      cwd: MOBILE_ROOT,
      stdio: 'inherit',
    });

    const metadata = JSON.parse(
      readFileSync(join(outDir, 'metadata.json'), 'utf8'),
    ) as ExpoExportMetadata;
    const platformMeta = metadata.fileMetadata[platform];
    if (!platformMeta) {
      throw new Error(`\`expo export\` metadata.json has no entry for platform "${platform}"`);
    }

    const jsBundleBytes = statSync(join(outDir, platformMeta.bundle)).size;
    const totalExportBytes = dirSizeBytes(outDir);

    return {
      platform,
      measuredAt: new Date().toISOString(),
      expoSdk: readExpoSdkVersion(),
      jsBundleBytes,
      totalExportBytes,
      assetCount: platformMeta.assets.length,
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString('en-US')} bytes (${(bytes / (1024 * 1024)).toFixed(2)} MiB)`;
}

function readBaselineFile(): Partial<Record<Platform, BundleSizeMeasurement>> {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Partial<
    Record<Platform, BundleSizeMeasurement>
  >;
}

function main(): void {
  const args = process.argv.slice(2);
  const record = args.includes('--record');
  const platformFlagIndex = args.indexOf('--platform');
  const requestedPlatform = platformFlagIndex >= 0 ? args[platformFlagIndex + 1] : 'ios';

  if (requestedPlatform !== 'ios' && requestedPlatform !== 'android') {
    console.error(`Unknown --platform "${requestedPlatform}" — expected "ios" or "android".`);
    process.exit(1);
  }
  const platform: Platform = requestedPlatform;

  console.log(`Measuring ${platform} bundle size via \`expo export\` (this shells out to Metro)…`);
  const result = measure(platform);

  const existingBaseline = readBaselineFile()[platform];

  console.log('');
  console.log(`Platform:              ${result.platform}`);
  console.log(`Expo SDK:              ${result.expoSdk}`);
  console.log(`JS bundle (Hermes):    ${formatBytes(result.jsBundleBytes)}`);
  console.log(
    `Total export payload:  ${formatBytes(result.totalExportBytes)} (bundle + every bundled asset/font for this platform)`,
  );
  console.log(`Asset count:           ${result.assetCount}`);

  if (existingBaseline) {
    const deltaBytes = result.jsBundleBytes - existingBaseline.jsBundleBytes;
    const deltaPercent =
      existingBaseline.jsBundleBytes > 0 ? (deltaBytes / existingBaseline.jsBundleBytes) * 100 : 0;
    console.log('');
    console.log(
      `Recorded baseline (${existingBaseline.measuredAt}): ${formatBytes(existingBaseline.jsBundleBytes)}`,
    );
    console.log(
      `Delta vs. recorded baseline: ${deltaBytes >= 0 ? '+' : ''}${deltaBytes.toLocaleString(
        'en-US',
      )} bytes (${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(2)}%)`,
    );
  }

  if (record) {
    const baseline = readBaselineFile();
    baseline[platform] = result;
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log('');
    console.log(`Recorded new baseline to ${BASELINE_PATH}`);
  }
}

main();

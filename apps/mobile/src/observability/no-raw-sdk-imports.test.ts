import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Adversarial guard (MOB-018): the crash/perf SDK must never be reached
 * directly by app code — every call must go through `reportError` /
 * `addBreadcrumb` / `startPerfTrace` / `reportPerf`, which enforce the
 * redaction pipeline (privacy invariant 7). This test statically scans the
 * ENTIRE `apps/mobile/src` tree for a raw import of the Crashlytics/Perf
 * packages outside the one file allowed to touch them
 * (`native-bridge.ts`), so a future accidental `import crashlytics from
 * '@react-native-firebase/crashlytics'` elsewhere fails CI instead of
 * quietly bypassing scrubbing.
 *
 * It also re-asserts bead requirement 4 ("no launch analytics dependency"):
 * no ad/tracking/general-analytics SDK is imported anywhere in the mobile
 * source tree. Crashlytics/Performance are diagnostic-only and are
 * deliberately NOT on this forbidden list.
 */

const SRC_DIR = resolve(__dirname, '..');
const ALLOWED_RAW_SDK_FILE = resolve(__dirname, 'native-bridge.ts');

const RAW_SDK_IMPORT_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: 'raw Crashlytics import',
    pattern: /require\(\s*['"]@react-native-firebase\/crashlytics['"]|from\s+['"]@react-native-firebase\/crashlytics['"]/,
  },
  {
    name: 'raw Performance Monitoring import',
    pattern: /require\(\s*['"]@react-native-firebase\/perf['"]|from\s+['"]@react-native-firebase\/perf['"]/,
  },
];

const FORBIDDEN_ANALYTICS_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'Firebase Analytics', pattern: /@react-native-firebase\/analytics/ },
  { name: 'Google Mobile Ads', pattern: /react-native-google-mobile-ads|admob/i },
  { name: 'Segment analytics', pattern: /@segment\/analytics-react-native/i },
  { name: 'Amplitude analytics', pattern: /@amplitude\/analytics-react-native/i },
  { name: 'Mixpanel analytics', pattern: /mixpanel-react-native/i },
  { name: 'App Tracking Transparency (ad tracking prompt)', pattern: /expo-tracking-transparency|react-native-tracking-transparency/i },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('crash/perf SDK is reachable only through the observability wrapper (MOB-018)', () => {
  const files = collectSourceFiles(SRC_DIR).filter((f) => f !== ALLOWED_RAW_SDK_FILE);

  it('finds mobile source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(RAW_SDK_IMPORT_PATTERNS)('no file other than native-bridge.ts adds $name', ({ pattern }) => {
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(pattern);
    }
  });
});

describe('no analytics/ad-tracking SDK anywhere in apps/mobile/src (MOB-018 item 4)', () => {
  const files = collectSourceFiles(SRC_DIR);

  it.each(FORBIDDEN_ANALYTICS_PATTERNS)('does not add $name', ({ pattern }) => {
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(pattern);
    }
  });
});

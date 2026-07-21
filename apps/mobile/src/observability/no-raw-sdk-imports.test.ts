import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Adversarial guard (MOB-018): no Firebase SDK and no ad/tracking analytics
 * SDK may be imported anywhere in `apps/mobile/src`. Client attestation uses
 * the `X-BlackStory-Client` header only; crash/perf reporting uses the
 * redacting dev-console sink in `crash-reporter.ts`.
 */

const SRC_DIR = resolve(__dirname, '..');

const FORBIDDEN_FIREBASE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: 'React Native Firebase app',
    pattern: /@react-native-firebase\/app/,
  },
  {
    name: 'React Native Firebase App Check',
    pattern: /@react-native-firebase\/app-check/,
  },
  {
    name: 'React Native Firebase Crashlytics',
    pattern: /@react-native-firebase\/crashlytics/,
  },
  {
    name: 'React Native Firebase Performance',
    pattern: /@react-native-firebase\/perf/,
  },
  {
    name: 'Firebase Analytics',
    pattern: /@react-native-firebase\/analytics/,
  },
];

const FORBIDDEN_ANALYTICS_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'Google Mobile Ads', pattern: /react-native-google-mobile-ads|admob/i },
  { name: 'Segment analytics', pattern: /@segment\/analytics-react-native/i },
  { name: 'Amplitude analytics', pattern: /@amplitude\/analytics-react-native/i },
  { name: 'Mixpanel analytics', pattern: /mixpanel-react-native/i },
  {
    name: 'App Tracking Transparency (ad tracking prompt)',
    pattern: /expo-tracking-transparency|react-native-tracking-transparency/i,
  },
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

describe('no Firebase SDK anywhere in apps/mobile/src', () => {
  const files = collectSourceFiles(SRC_DIR);

  it('finds mobile source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_FIREBASE_PATTERNS)('does not import $name', ({ pattern }) => {
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

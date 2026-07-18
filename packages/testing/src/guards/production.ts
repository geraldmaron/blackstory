
/**
 * Fail-closed production service guards for the test suite.
 * Tests must never target production Firebase, Cloud SQL, or GCP projects.
 */

export type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export type ProductionGuardFinding = {
  readonly key: string;
  readonly reason: string;
  readonly value: string;
};

const PRODUCTION_PROJECT_PATTERN =
  /(^|[-_])(prod|production|live)([-_]|$)|the related workstream|blackbook-prod|^black-book-efaaf$/i;

const CLOUD_SQL_HOST_PATTERN =
  /\.sql\.goog$|cloudsql|\/cloudsql\/|googleapis\.com|neon\.tech|supabase\.co|aws\.com|azure\.com/i;

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|host\.docker\.internal)(:\d+)?$/i;

const DEMO_PROJECT_PATTERN = /^(demo-|test-|local-|dev-)/i;


/**
 * Explicit override for rare break-glass scenarios. Prefer never setting this.
 * Even with the override, Cloud SQL Firebase production project IDs still fail.
 */
export const PRODUCTION_OVERRIDE_ENV = 'APP_ALLOW_PRODUCTION_TESTS';

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      return false;
    }
    if (CLOUD_SQL_HOST_PATTERN.test(parsed.hostname) || CLOUD_SQL_HOST_PATTERN.test(url)) {
      return false;
    }
    return LOCAL_HOST_PATTERN.test(parsed.hostname) || parsed.hostname === '';
  } catch {
    return false;
  }
}

export function looksLikeProductionProjectId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (DEMO_PROJECT_PATTERN.test(trimmed)) return false;
  return PRODUCTION_PROJECT_PATTERN.test(trimmed);
}

export function collectProductionGuardFindings(
  environment: EnvironmentLike = process.env,
): ProductionGuardFinding[] {
  const findings: ProductionGuardFinding[] = [];

  const nodeEnv = environment.NODE_ENV ?? environment.APP_ENV;
  if (nodeEnv === 'production') {
    findings.push({
      key: 'NODE_ENV',
      reason: 'Tests refuse NODE_ENV/APP_ENV=production',
      value: nodeEnv,
    });
  }

  for (const key of [
    'GCLOUD_PROJECT',
    'GOOGLE_CLOUD_PROJECT',
    'GCP_PROJECT',
    'FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ] as const) {
    const value = environment[key];
    if (value && looksLikeProductionProjectId(value)) {
      findings.push({
        key,
        reason: 'Value looks like a production GCP/Firebase project id',
        value,
      });
    }
  }

  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'CLOUD_SQL_CONNECTION_NAME'] as const) {
    const value = environment[key];
    if (!value) continue;
    if (key === 'CLOUD_SQL_CONNECTION_NAME') {
      findings.push({
        key,
        reason: 'Cloud SQL connection names are forbidden in tests',
        value,
      });
      continue;
    }
    if (!isLocalDatabaseUrl(value)) {
      findings.push({
        key,
        reason: 'Database URL is not a local disposable endpoint',
        value,
      });
    }
  }

  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'] as const) {
    const value = environment[key];
    if (!value) continue;
    const host = value.includes('://') ? value : `http://${value}`;
    try {
      const parsed = new URL(host);
      if (!LOCAL_HOST_PATTERN.test(parsed.hostname)) {
        findings.push({
          key,
          reason: 'Emulator host must be loopback/local only',
          value,
        });
      }
    } catch {
      findings.push({
        key,
        reason: 'Emulator host is not a valid host:port value',
        value,
      });
    }
  }

  return findings;
}

export function assertTestsCannotAccessProduction(
  environment: EnvironmentLike = process.env,
): void {
  const findings = collectProductionGuardFindings(environment);
  if (findings.length === 0) return;

  const override = environment[PRODUCTION_OVERRIDE_ENV] === '1';
  const hardFindings = findings.filter(
    (finding) =>
      finding.key === 'CLOUD_SQL_CONNECTION_NAME' ||
      finding.key.startsWith('FIRE') ||
      finding.key.includes('DATABASE') ||
      finding.key.includes('POSTGRES') ||
      finding.key.includes('PROJECT'),
  );

  if (override && hardFindings.length === 0) {
    return;
  }

  const details = findings
    .map((finding) => `- ${finding.key}: ${finding.reason} (${finding.value})`)
    .join('\n');
  throw new Error(
    `Refusing to run tests that may reach production services:\n${details}\n` +
      'Use local PostGIS, demo Firebase emulators, or disposable CI services only.',
  );
}

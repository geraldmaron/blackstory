
/**
 * Firebase emulator harness for Auth/Firestore integration tests.
 * Requires local Java + running emulators unless CI_REQUIRE_FIREBASE=1 fails closed.
 */
import { spawnSync } from 'node:child_process';
import { assertTestsCannotAccessProduction } from '../guards/production.js';

export const REQUIRE_FIREBASE_ENV = 'CI_REQUIRE_FIREBASE';

export type FirebaseHarness = {
  readonly available: boolean;
  readonly reason?: string;
  readonly projectId: string;
  readonly authHost?: string;
  readonly firestoreHost?: string;
};

const DEMO_PROJECT_ID = 'demo-black-book';

function javaAvailable(): boolean {
  const result = spawnSync('java', ['-version'], { encoding: 'utf8' });
  // java -version writes to stderr; status 0 means a runtime exists
  return result.status === 0;
}

function parseHostPort(hostPort: string): { host: string; port: number } | undefined {
  const normalized = hostPort.includes('://') ? hostPort : `http://${hostPort}`;
  try {
    const url = new URL(normalized);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (!url.hostname || !Number.isFinite(port)) return undefined;
    return { host: url.hostname, port };
  } catch {
    return undefined;
  }
}

function tcpReachable(hostPort: string | undefined, timeoutMs = 1000): boolean {
  if (!hostPort) return false;
  const parsed = parseHostPort(hostPort);
  if (!parsed) return false;
  return (
    spawnSync(
      process.execPath,
      [
        '-e',
        `
      const net = require('net');
      const socket = net.connect(${parsed.port}, ${JSON.stringify(parsed.host)}, () => {
        socket.end();
        process.exit(0);
      });
      socket.on('error', () => process.exit(1));
      setTimeout(() => process.exit(1), ${timeoutMs});
      `,
      ],
      { encoding: 'utf8', env: process.env },
    ).status === 0
  );
}


/**
 * Probes configured Firebase emulator endpoints for demo-only testing.
 */
export function createFirebaseHarness(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): FirebaseHarness {
  const projectId = environment.FIREBASE_PROJECT_ID ?? DEMO_PROJECT_ID;
  assertTestsCannotAccessProduction({
    ...environment,
    FIREBASE_PROJECT_ID: projectId,
  });

  const authHost = environment.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const firestoreHost = environment.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

  const authUp = tcpReachable(authHost);
  const firestoreUp = tcpReachable(firestoreHost);
  if (authUp || firestoreUp) {
    return {
      available: true,
      projectId,
      authHost,
      firestoreHost,
    };
  }

  if (!javaAvailable()) {
    return unavailable(
      projectId,
      'Java runtime is required to start Firebase emulators (or set FIRESTORE_EMULATOR_HOST)',
    );
  }

  return unavailable(
    projectId,
    'Firebase emulators are not reachable (run `pnpm firebase:emulators`)',
  );
}

function unavailable(projectId: string, reason: string): FirebaseHarness {
  const required = process.env[REQUIRE_FIREBASE_ENV] === '1';
  if (required) {
    throw new Error(
      `Firebase harness required (${REQUIRE_FIREBASE_ENV}=1) but unavailable: ${reason}`,
    );
  }
  return {
    available: false,
    reason,
    projectId,
  };
}

export function firebaseHarnessGate(harness: FirebaseHarness): { skip: boolean } {
  return { skip: !harness.available };
}

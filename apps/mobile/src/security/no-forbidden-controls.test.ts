import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Adversarial guard (MOB-010): the bead EXPLICITLY FORBIDS adding
 * certificate pinning or root/jailbreak detection as a client-side substitute
 * for the server-side controls. These are not defences on an untrusted client
 * (a rooted device defeats them, threat-model T1) and they add native surface,
 * fragility, and a false sense of security. The real controls are
 * server-authoritative validation + App Check as a signal, not a gate.
 *
 * This test statically scans the security source for the tell-tale APIs so a
 * future accidental (or well-meaning) addition fails CI.
 */

const SECURITY_DIR = __dirname;

// Identifiers that would indicate cert-pinning or root/jailbreak detection.
// Word-boundary / API-name matches to avoid false positives on prose.
const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'certificate pinning (SSL pinning lib)', pattern: /ssl[-_]?pinning/i },
  { name: 'certificate pinning (TrustKit)', pattern: /trustkit/i },
  { name: 'certificate pinning (pinned public key)', pattern: /pinnedPublicKey|publicKeyPin|pinnedCertificates/i },
  { name: 'root detection', pattern: /isRooted|rootBeer|detectRoot/i },
  { name: 'jailbreak detection', pattern: /isJailB|jailbreakDetect|jailMonkey/i },
  { name: 'emulator/frida detection substitute', pattern: /detectFrida|isEmulatorBlock/i },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
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

describe('forbidden client-side security controls are absent (MOB-010)', () => {
  const files = collectSourceFiles(SECURITY_DIR);

  it('finds security source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_PATTERNS)(
    'does not add $name',
    ({ pattern }) => {
      for (const file of files) {
        const contents = readFileSync(file, 'utf8');
        expect(contents).not.toMatch(pattern);
      }
    },
  );
});

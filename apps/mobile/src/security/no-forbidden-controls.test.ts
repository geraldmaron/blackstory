import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Reject certificate pinning and root/jailbreak detection as substitutes for server
 * authorization, validation and budgets. This static guard checks the security source for
 * prohibited client controls.
 */

const SECURITY_DIR = __dirname;

// Identifiers that would indicate cert-pinning or root/jailbreak detection.
// Word-boundary / API-name matches to avoid false positives on prose.
const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'certificate pinning (SSL pinning lib)', pattern: /ssl[-_]?pinning/i },
  { name: 'certificate pinning (TrustKit)', pattern: /trustkit/i },
  {
    name: 'certificate pinning (pinned public key)',
    pattern: /pinnedPublicKey|publicKeyPin|pinnedCertificates/i,
  },
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

  it.each(FORBIDDEN_PATTERNS)('does not add $name', ({ pattern }) => {
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(pattern);
    }
  });
});

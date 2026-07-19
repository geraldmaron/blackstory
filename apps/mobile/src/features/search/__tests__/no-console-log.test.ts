/**
 * MOB-013 item 8's "no-query-log snapshot test": statically scans every non-test source file in
 * this feature directory and asserts NONE of them call any `console.*` method at all. This is a
 * stronger, easier-to-verify guarantee than "no query text specifically" -- rather than trying to
 * pattern-match "is this particular console argument a query string" (fragile against
 * refactors), the search feature simply never logs anything, full stop. Combined with
 * `recent-searches.ts` never transmitting a term anywhere and `search-controller.ts` never
 * persisting raw query text to any cache keyed by anything other than a salted hash
 * (`cache-policy.ts`'s NEVER_CACHE_KEY_PATTERNS backstops this independently at the MOB-009
 * layer), this closes the loop: a query string reaches neither `console.log`, a persisted cache
 * entry keyed by raw text, nor any analytics call from code this bead owns.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FEATURE_DIR = join(__dirname, '..');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue; // this file lives there; test files are not the guarantee's target
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const CONSOLE_CALL_PATTERN = /\bconsole\s*\.\s*[a-zA-Z]+\s*\(/;
/** Also forbid a bare reference to the global `console` object at all (e.g. passing it to
 * something, or `globalThis.console`) -- not just a direct method call. */
const CONSOLE_REFERENCE_PATTERN = /\bconsole\b/;

describe('no-query-log guarantee: this feature never calls console.* anywhere', () => {
  const files = listSourceFiles(FEATURE_DIR);

  it('found at least the expected source files (sanity check that the scan is not vacuously empty)', () => {
    expect(files.length).toBeGreaterThan (5);
  });

  it.each(files.map((f) => [f.replace(FEATURE_DIR, ''), f] as const))('%s never references `console`', (_label, file) => {
    const contents = readFileSync(file, 'utf8');
    const hasCall = CONSOLE_CALL_PATTERN.test(contents);
    const hasReference = CONSOLE_REFERENCE_PATTERN.test(contents);
    expect({ file: _label, hasCall, hasReference }).toEqual({ file: _label, hasCall: false, hasReference: false });
  });
});

describe('no-query-log guarantee: no analytics-shaped call site in this feature', () => {
  const files = listSourceFiles(FEATURE_DIR);
  // program invariant 7 / ADR-020 §3: no analytics SDK is even a dependency, but scan for the
  // SHAPE of an analytics call too (defense in depth against a future accidental import).
  const ANALYTICS_PATTERN = /\b(analytics|logEvent|trackEvent|Sentry\.captureMessage)\s*\(/i;

  it.each(files.map((f) => [f.replace(FEATURE_DIR, ''), f] as const))('%s has no analytics-shaped call', (_label, file) => {
    const contents = readFileSync(file, 'utf8');
    expect(ANALYTICS_PATTERN.test(contents)).toBe(false);
  });
});

/**
 * Fail-closed compliance guards for the Reddit adapter (BB-074). These are runtime assertions —
 * not just comments — that the adapter's exported surface and normalized payloads never grow a
 * republication path, an ML-training path, or an identity-resolving field. reddit.test.ts calls
 * every one of these against the adapter's real module exports and real normalized output, so a
 * future change that adds a forbidden function/field fails the test suite, not just review.
 *
 * Deanonymization itself is governed by the existing BB-077 guard
 * (../../rights/living-person-ugc.ts assertNoDeanonymization) — this module does not
 * reimplement that check, it only proves nothing in this adapter tries to route around it (see
 * reddit.test.ts).
 */

/**
 * Export names that would indicate a republication or ML-training path has been added to the
 * adapter's public surface. Matched against every key `export * from './reddit/index.js'`
 * exposes.
 */
const FORBIDDEN_EXPORT_NAME_PATTERNS: readonly RegExp[] = [
  /republish/i,
  /^publish/i,
  /toPublic/i,
  /publicProjection/i,
  /mlTraining/i,
  /trainingExport/i,
  /trainingCorpus/i,
  /trainingDataset/i,
  /deanonymize/i,
  /resolveIdentity/i,
  /resolveAuthor/i,
  /realName/i,
];

/**
 * Throws if any exported name in `moduleExports` matches a forbidden pattern. Call with
 * `import * as redditAdapter from './index.js'` to check the adapter's real, live export
 * surface — not a hand-maintained list that could drift from what's actually exported.
 */
export function assertNoForbiddenExportSurface(moduleExports: Readonly<Record<string, unknown>>): void {
  for (const name of Object.keys(moduleExports)) {
    for (const pattern of FORBIDDEN_EXPORT_NAME_PATTERNS) {
      if (pattern.test(name)) {
        throw new Error(
          `Reddit adapter export "${name}" matches forbidden pattern ${pattern.source}: no ` +
            'republication, ML-training, or deanonymization path may exist on this adapter (BB-074)',
        );
      }
    }
  }
}

/**
 * Field keys that would indicate real-identity data (as opposed to a pseudonymous handle) is
 * being smuggled into a Reddit payload/pointer. Checked defensively wherever untyped/adapter-
 * sourced data is normalized — mirrors ../../rights/evidence-pointer.ts's
 * `assertNoFullPageFields` pattern for the same class of defect.
 */
const PROHIBITED_IDENTITY_KEYS = new Set([
  'email',
  'realname',
  'legalname',
  'fullname',
  'authorfullname',
  'phone',
  'phonenumber',
  'address',
  'ipaddress',
  'ip',
  'deviceid',
  'ssn',
  'identity',
  'accountid',
]);

/** Field keys that would indicate a full post body / comment tree is being stored, rather than
 *  the mandatory-capped triage snippet. Mirrors evidence-pointer.ts's full-page-field guard. */
const PROHIBITED_FULL_CONTENT_KEYS = new Set([
  'body',
  'bodyhtml',
  'selftext',
  'selftexthtml',
  'fulltext',
  'comments',
  'commenttree',
  'rawhtml',
  'html',
]);

export function assertNoIdentityFields(value: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(value)) {
    if (PROHIBITED_IDENTITY_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `Reddit payload cannot include identity-resolving field "${key}": authors are stored as ` +
          'a handle only, never resolved further (BB-074/BB-077)',
      );
    }
  }
}

export function assertNoFullContentFields(value: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(value)) {
    if (PROHIBITED_FULL_CONTENT_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `Reddit payload cannot include full-content field "${key}": only a capped triage snippet ` +
          'is ever stored, never a full post body or comment tree (BB-074/BB-077)',
      );
    }
  }
}

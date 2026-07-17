/**
 * Trusted Types helpers and rollout notes (BB-028).
 *
 * Full enforcement (`require-trusted-types-for 'script'`) is opt-in via CSP because
 * Next.js App Router still emits inline bootstrap scripts. Rollout plan:
 * 1. Deploy CSP with `trusted-types` allowlist only (no require-*).
 * 2. Add a client policy in layout once inline scripts are nonce-scoped.
 * 3. Enable `enforceTrustedTypes` in buildContentSecurityPolicy after audit.
 */

export const TRUSTED_TYPES_POLICY_NAME = 'blackBookDefault';

export type TrustedTypesPolicy = {
  createHTML: (input: string) => string;
  createScriptURL: (input: string) => string;
  createScript: (input: string) => string;
};

/** Identity stub until a browser policy is registered on the client. */
export function createTrustedTypesPolicyStub(): TrustedTypesPolicy {
  return {
    createHTML: (input) => input,
    createScriptURL: (input) => input,
    createScript: (input) => input,
  };
}

/**
 * Register a Trusted Types policy when `window.trustedTypes` is available.
 * Safe to call from client components during Trusted Types rollout.
 */
export function registerTrustedTypesPolicyStub(): TrustedTypesPolicy | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const trustedTypes = (globalThis as { trustedTypes?: { createPolicy: (
    name: string,
    rules: TrustedTypesPolicy,
  ) => TrustedTypesPolicy } }).trustedTypes;
  if (!trustedTypes?.createPolicy) {
    return createTrustedTypesPolicyStub();
  }
  try {
    return trustedTypes.createPolicy(TRUSTED_TYPES_POLICY_NAME, createTrustedTypesPolicyStub());
  } catch {
    return createTrustedTypesPolicyStub();
  }
}

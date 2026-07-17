
/**
 * Deterministic security-gate contracts for API authorization, browser request
 * defenses, staging DAST isolation, suppressions, and release provenance.
 */

export type ApiActor =
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'end_user'; readonly subject: string }
  | {
      readonly kind: 'staff';
      readonly subject: string;
      readonly roles: readonly ('admin' | 'publication' | 'research' | 'security')[];
      readonly mfa: boolean;
    }
  | {
      readonly kind: 'service';
      readonly subject: string;
      readonly service: 'publication-worker' | 'research-worker';
    };

export type ApiOperation =
  | { readonly kind: 'public_read' }
  | { readonly kind: 'submission_read'; readonly ownerSubject: string }
  | { readonly kind: 'submission_update'; readonly ownerSubject: string }
  | { readonly kind: 'publication_activate' }
  | { readonly kind: 'admin_export' };

export type GateDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly status: 401 | 403 };

const denied = (reason: string, status: 401 | 403 = 403): GateDecision => ({
  allowed: false,
  reason,
  status,
});

/** Enforces endpoint and object-level authorization without trusting request fields. */
export function authorizeApiOperation(actor: ApiActor, operation: ApiOperation): GateDecision {
  if (operation.kind === 'public_read') return { allowed: true };
  if (actor.kind === 'anonymous') return denied('authenticated_identity_required', 401);
  if (operation.kind === 'submission_read' || operation.kind === 'submission_update') {
    return actor.kind === 'end_user' && actor.subject === operation.ownerSubject
      ? { allowed: true }
      : denied('object_owner_mismatch');
  }
  if (operation.kind === 'publication_activate') {
    if (actor.kind === 'service') {
      return actor.service === 'publication-worker'
        ? { allowed: true }
        : denied('service_not_authorized_for_release');
    }
    return actor.kind === 'staff' &&
      actor.mfa &&
      (actor.roles.includes('publication') || actor.roles.includes('admin'))
      ? { allowed: true }
      : denied('publication_role_and_mfa_required');
  }
  return actor.kind === 'staff' &&
    actor.mfa &&
    (actor.roles.includes('security') || actor.roles.includes('admin'))
    ? { allowed: true }
    : denied('security_role_and_mfa_required');
}

export type BrowserMutation = {
  readonly method: string;
  readonly origin?: string;
  readonly expectedOrigin: string;
  readonly csrfCookie?: string;
  readonly csrfHeader?: string;
};

/** Requires same-origin double-submit CSRF proof on state-changing browser requests. */
export function validateBrowserMutation(request: BrowserMutation): GateDecision {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) return { allowed: true };
  if (request.origin !== request.expectedOrigin) return denied('origin_mismatch');
  if (
    !request.csrfCookie ||
    !request.csrfHeader ||
    request.csrfCookie.length < 32 ||
    request.csrfCookie !== request.csrfHeader
  ) {
    return denied('csrf_proof_invalid');
  }
  return { allowed: true };
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes untrusted text for an HTML text/attribute context; URLs need separate policy. */
export function escapeUntrustedHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => HTML_ESCAPES[character]!);
}

export type SubmissionPatch = {
  readonly title?: string;
  readonly statement?: string;
  readonly sourceUrls?: readonly string[];
};

export type MassAssignmentResult = {
  readonly patch: SubmissionPatch;
  readonly rejectedKeys: readonly string[];
};

/** Allowlists mutable submission fields and reports every attempted privileged field. */
export function filterSubmissionPatch(
  input: Readonly<Record<string, unknown>>,
): MassAssignmentResult {
  const patch: { title?: string; statement?: string; sourceUrls?: readonly string[] } = {};
  const rejectedKeys: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (key === 'title' && typeof value === 'string') {
      patch.title = value;
    } else if (key === 'statement' && typeof value === 'string') {
      patch.statement = value;
    } else if (
      key === 'sourceUrls' &&
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      patch.sourceUrls = value;
    } else {
      rejectedKeys.push(key);
    }
  }
  return { patch, rejectedKeys: rejectedKeys.sort() };
}

export type SecuritySuppression = {
  readonly id: string;
  readonly tool: string;
  readonly finding: string;
  readonly reason: string;
  readonly owner: string;
  readonly expiresAt: string;
};

/** Rejects incomplete, expired, or unbounded finding suppressions. */
export function validateSuppression(
  suppression: SecuritySuppression,
  now = new Date(),
): readonly string[] {
  const issues: string[] = [];
  if (!suppression.reason.trim()) issues.push('reason_required');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(suppression.owner)) {
    issues.push('owner_team_and_handle_required');
  }
  const expiration = Date.parse(suppression.expiresAt);
  if (!Number.isFinite(expiration)) {
    issues.push('expiration_invalid');
  } else if (expiration <= now.getTime()) {
    issues.push('expiration_not_future');
  }
  return issues;
}

export type StagingDastConfiguration = {
  readonly baseUrl: string;
  readonly identityLabel: string;
  readonly environment: string;
};

/** Allows DAST only against HTTPS staging with a clearly isolated test identity. */
export function validateStagingDastConfiguration(
  configuration: StagingDastConfiguration,
): readonly string[] {
  const issues: string[] = [];
  let url: URL | undefined;
  try {
    url = new URL(configuration.baseUrl);
  } catch {
    issues.push('base_url_invalid');
  }
  if (url && (url.protocol !== 'https:' || !/(?:^|[.-])staging(?:[.-]|$)/iu.test(url.hostname))) {
    issues.push('staging_https_target_required');
  }
  if (configuration.environment !== 'staging') issues.push('production_dast_forbidden');
  if (!configuration.identityLabel.startsWith('bb-security-dast-')) {
    issues.push('isolated_test_identity_required');
  }
  return issues;
}

export type ReleaseSecurityEvidence = {
  readonly testedCommitSha: string;
  readonly deployedCommitSha: string;
  readonly imageReference: string;
  readonly testedImageDigest: string;
  readonly deployedImageDigest: string;
  readonly signature: {
    readonly verified: boolean;
    readonly signedDigest: string;
    readonly issuer: 'https://token.actions.githubusercontent.com';
    readonly identity: string;
  };
  readonly artifacts: readonly {
    readonly name: string;
    readonly retainedWithRelease: boolean;
  }[];
};

/** Proves production uses the exact scanned commit and signed immutable image digest. */
export function validateReleaseSecurityEvidence(
  evidence: ReleaseSecurityEvidence,
): readonly string[] {
  const issues: string[] = [];
  const shaPattern = /^[0-9a-f]{40}$/u;
  const digestPattern = /^sha256:[0-9a-f]{64}$/u;
  if (
    !shaPattern.test(evidence.testedCommitSha) ||
    evidence.testedCommitSha !== evidence.deployedCommitSha
  ) {
    issues.push('deployed_commit_not_tested_commit');
  }
  if (
    !digestPattern.test(evidence.testedImageDigest) ||
    evidence.testedImageDigest !== evidence.deployedImageDigest ||
    !evidence.imageReference.endsWith(`@${evidence.deployedImageDigest}`)
  ) {
    issues.push('deployed_image_not_tested_digest');
  }
  if (
    !evidence.signature.verified ||
    evidence.signature.signedDigest !== evidence.deployedImageDigest ||
    evidence.signature.issuer !== 'https://token.actions.githubusercontent.com' ||
    !/^https:\/\/github\.com\/[^/]+\/[^/]+\/\.github\/workflows\/[^@]+@refs\/heads\/main$/u.test(
      evidence.signature.identity,
    )
  ) {
    issues.push('release_signature_invalid');
  }
  if (
    evidence.artifacts.length === 0 ||
    evidence.artifacts.some((artifact) => !artifact.retainedWithRelease)
  ) {
    issues.push('security_artifacts_not_retained');
  }
  return issues;
}

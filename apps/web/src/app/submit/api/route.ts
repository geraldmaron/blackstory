/**
 * Public "submit a lead" intake endpoint. Node.js runtime. Behind request-integrity
 * + rate limits, writing create-only into quarantine via the real
 * `createQuarantinedSubmission`. Nothing here writes a canonical record, opens a research
 * case, or evaluates a promotion gate — a quarantined lead only ever advances through
 * consensus review (`@repo/domain`'s `packages/domain/src/consensus-review/`), a separate,
 * human-gated step.
 */
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createQuarantinedSubmission } from '@repo/security';
import { createSubmitLeadRequestIntegrityGuard } from '../request-integrity-guard';
import { createSubmitLeadRateLimitGuard } from '../rate-limit-guard';
import { validateLeadSubmission, type LeadSubmissionInput } from '../lead-intake';

export const runtime = 'nodejs';

const requestIntegrityGuard = createSubmitLeadRequestIntegrityGuard();
const rateLimitGuard = createSubmitLeadRateLimitGuard();

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function clientIpFrom(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || undefined;
}

function requirePrivacyPepper(): string {
  const pepper = process.env.SUBMISSION_PRIVACY_PEPPER;
  if (pepper && pepper.trim()) return pepper;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUBMISSION_PRIVACY_PEPPER must be set in production');
  }
  return 'local-dev-only-pepper-do-not-use-in-production';
}

/** Never store a raw client IP as the campaign-detector network token only a keyed hash.  */
function networkTokenFor(clientIp: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}${clientIp}`).digest('hex');
}

export async function POST(request: Request): Promise<Response> {
  const clientIp = clientIpFrom(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  const integrityDecision = await requestIntegrityGuard({ headers: request.headers });
  if (!integrityDecision.allowed) {
    return jsonError(integrityDecision.status, 'request_integrity_required', {
      reason: integrityDecision.reason,
    });
  }

  const rateDecision = rateLimitGuard.evaluate({
    subject: 'anonymous',
    ...(clientIp ? { clientIp } : {}),
    // Monitor allow-through must satisfy the quota gate; otherwise missing integrity
    // tokens become fake 429s. Field name remains appCheckVerified for @repo/security compat.
    appCheckVerified: integrityDecision.verified || integrityDecision.mode === 'monitor',
  });
  if (!rateDecision.allowed) {
    const response = rateLimitGuard.formatDeniedResponse(rateDecision);
    return NextResponse.json(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  try {
    const validation = validateLeadSubmission(body as LeadSubmissionInput);
    if (!validation.valid) {
      return jsonError(400, 'validation_failed', { issues: validation.issues });
    }

    const pepper = requirePrivacyPepper();
    const result = createQuarantinedSubmission(validation.payload, {
      receivedAtMs: Date.now(),
      privacyPepper: pepper,
      ...(clientIp ? { networkToken: networkTokenFor(clientIp, pepper) } : {}),
    });

    if (!result.accepted) {
      return jsonError(400, 'validation_failed', { issues: result.rejection.issues });
    }

    // 202 Accepted: this is a quarantine write, never a confirmation that the lead is public,
    // true, or will ever be researched it only confirms the lead entered the moderated queue.
    return NextResponse.json(
      {
        accepted: true,
        submissionId: result.record.id,
        moderationState: result.record.moderationState,
      },
      { status: 202 },
    );
  } finally {
    rateLimitGuard.release(rateDecision.key);
  }
}

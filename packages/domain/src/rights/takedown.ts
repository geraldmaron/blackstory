/**
 * Public takedown/contest routing.
 *
 * The public-facing takedown page UI is not built yet — this module is the routing/data-model
 * piece only: it produces a takedown-request record shaped to land in the same intake path
 * already built (`packages/security/src/submissions/quarantine.ts`
 * `SubmissionKind`/`SubmissionInput`), tagged distinctly so a moderation queue can
 * special-case it, plus a documented SLA.
 *
 * `@repo/domain` cannot import `@repo/security` (security depends on domain, so
 * the reverse would be a circular workspace dependency). The shape below is intentionally
 * structurally compatible with `SubmissionInput`
 * (`kind`/`title`/`statement`/`sourceUrls`/`targetRecordId`/`submitterContact`) so a future
 * integration can map one onto the other without redesigning either side. Do not build the
 * public page here; it does not exist yet.
 */
import { evaluateLivingStatus, loadProductConstitution, type ProductConstitution } from '@repo/schemas';

export const TAKEDOWN_REASONS = [
  'privacy_deletion_request',
  'copyright_claim',
  'factual_dispute',
  'harassment_or_doxxing',
  'other',
] as const;

export type TakedownReason = (typeof TAKEDOWN_REASONS)[number];

/** Distinct tag so intake/moderation can special-case takedowns among ordinary corrections. */
export const TAKEDOWN_DISTINCT_TAG = 'takedown' as const;

/**
 * Closest existing SubmissionKind a takedown maps onto for shared intake, pending a
 * native 'takedown' SubmissionKind that addition is /call, out of scope here.
 */
export const TAKEDOWN_BRIDGE_SUBMISSION_KIND = 'abuse_report' as const;

/** Acknowledgment SLA: routing/triage into the corrections pipeline must occur within this window. */
export const TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS = 72;
/** Resolution SLA: publish/deny/redact decision target. */
export const TAKEDOWN_RESOLUTION_SLA_DAYS = 30;

export type TakedownRequestInput = {
  readonly targetRecordId: string;
  readonly reason: TakedownReason;
  readonly statement: string;
  readonly requestorContact?: string;
  readonly sourceUrls?: readonly string[];
  /** Requester's assertion about the subject's living status, used only to prioritize triage. */
  readonly assertedLivingStatus?: string;
};

export type TakedownRequestSla = {
  readonly acknowledgeBy: string;
  readonly resolveBy: string;
};

export type TakedownRequestRecord = {
  readonly id: string;
  readonly distinctTag: typeof TAKEDOWN_DISTINCT_TAG;
  readonly bridgeSubmissionKind: typeof TAKEDOWN_BRIDGE_SUBMISSION_KIND;
  readonly input: TakedownRequestInput;
  readonly sla: TakedownRequestSla;
  /** True for privacy/harassment takedowns concerning a living (or unknown) person. */
  readonly elevatedPriority: boolean;
  readonly receivedAt: string;
  readonly status: 'received';
};

export function assertTakedownReasonValid(reason: string): asserts reason is TakedownReason {
  if (!(TAKEDOWN_REASONS as readonly string[]).includes(reason)) {
    throw new Error(`Unknown takedown reason: ${reason}`);
  }
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function addDays(iso: string, days: number): string {
  return addHours(iso, days * 24);
}

/**
 * Build a takedown request record ready to land in intake path. Data-model/routing
 * only see module doc for what this deliberately does not build (the public page).
 */
export function buildTakedownRequestRecord(
  id: string,
  input: TakedownRequestInput,
  receivedAt: string,
  policy: ProductConstitution = loadProductConstitution(),
): TakedownRequestRecord {
  assertTakedownReasonValid(input.reason);
  if (!input.targetRecordId?.trim()) {
    throw new Error('Takedown requests require a targetRecordId');
  }
  if (!input.statement?.trim()) {
    throw new Error('Takedown requests require a statement');
  }

  const isPrivacyOrHarassment =
    input.reason === 'privacy_deletion_request' || input.reason === 'harassment_or_doxxing';
  const elevatedPriority =
    isPrivacyOrHarassment &&
    evaluateLivingStatus(input.assertedLivingStatus ?? 'unknown', policy).treatAsLiving;

  return {
    id,
    distinctTag: TAKEDOWN_DISTINCT_TAG,
    bridgeSubmissionKind: TAKEDOWN_BRIDGE_SUBMISSION_KIND,
    input,
    sla: {
      acknowledgeBy: addHours(receivedAt, TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS),
      resolveBy: addDays(receivedAt, TAKEDOWN_RESOLUTION_SLA_DAYS),
    },
    elevatedPriority,
    receivedAt,
    status: 'received',
  };
}

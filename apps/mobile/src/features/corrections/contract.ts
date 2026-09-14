/**
 * Wire contract for the correction submission + status endpoints (MOB-016).
 *
 * This is the MOBILE CLIENT's view of the server contract already implemented,
 * and tested, by the web corrections flow (`apps/web/src/app/corrections/**`):
 *   - submit:  POST  → `{ accepted: true, receiptCode, statusHref }` (202)
 *   - status:  by opaque receipt code → coarse public phase only.
 *
 * The production home for these writes is the tightly rate-limited
 * **submissions** surface (`apps/api-submissions`, quarantine-only, cannot
 * publish), not `apps/api-public` — see `docs/decisions-carryover.md`,
 * "ADR-021's two invariants": the submissions surface. That route is wired
 * now: `apps/api-submissions/src/http/router.ts` serves `POST /v1/corrections`
 * and `POST /v1/corrections/status` through `src/http/handlers.ts`, and every
 * write goes through `createSubmissionQuarantineService().intake()`. It serves
 * the same JSON contract the web Next.js route does, which is the contract
 * below, so this client needed no change when the route landed. The response
 * *shapes* mirror `apps/web/src/app/corrections/public-status.ts` and
 * `.../api/handler.ts`.
 *
 * Nothing here encodes correction content or the receipt code into a URL:
 * the submit payload rides the POST body, and status lookup sends the receipt
 * in the POST body too (NOT a `?receipt=` query string) precisely so the opaque
 * receipt never lands in a URL/query an intermediary or access log could
 * capture — a deliberate hardening over web's GET `?receipt=` that preserves the
 * same non-revealing public-status semantics (requirement #5; invariant 7).
 */
import type { CorrectionCategory, CorrectionTargetType } from './categories';

/** `/vN` major this build targets — mirrors bootstrap.ts's API_MAJOR. */
export const CORRECTIONS_API_MAJOR = 1;

/** Submissions-surface paths, matching `apps/api-submissions/src/http/handlers.ts`'s
 * `CORRECTION_SUBMIT_PATH`/`CORRECTION_STATUS_PATH`. Relative to the submissions base URL. */
export const CORRECTION_SUBMIT_PATH = '/v1/corrections';
export const CORRECTION_STATUS_PATH = '/v1/corrections/status';

/**
 * Idempotency header. Sent with every submit so a retry of the SAME content
 * (e.g. after the app is killed post-write, requirement #3) is recognizable as
 * a replay rather than a new distinct quarantine entry. This mirrors — and does
 * not replace — the server's authoritative content-hash duplicate detection
 * (`@repo/security`'s `createSubmissionCampaignDetector` /
 * `verifyOriginalIntegrity`, exercised by web's handler): identical content is
 * already collapsed server-side regardless of this header.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** The exact body the server's correction validator accepts (mirrors web's
 * `CorrectionSubmissionInput`). The mobile app sends this raw shape; the server
 * composes the moderator-facing statement and is authoritative on validation. */
export type CorrectionSubmissionRequest = {
  readonly targetType: CorrectionTargetType;
  readonly targetRecordId: string;
  readonly category: CorrectionCategory;
  readonly statement: string;
  readonly sourceUrl?: string;
  readonly privacyConsent: boolean;
  readonly contact?: string;
};

/** 202 accepted body from the submit endpoint. */
export type CorrectionAcceptedResponse = {
  readonly accepted: true;
  readonly receiptCode: string;
  readonly statusHref: string;
};

/** Coarse public phase — the ONLY status vocabulary exposed to a submitter.
 * Mirrors web's `PublicCorrectionPhase`; deliberately carries no moderation
 * state (spam score, campaign flag, duplicate list) — status enumeration and
 * moderation-state leakage are designed out at the contract level. */
export type PublicCorrectionPhase = 'received' | 'under_review' | 'closed';

/** Mirrors web's `PublicCorrectionStatus` (public-safe subset). */
export type PublicCorrectionStatus = {
  readonly phase: PublicCorrectionPhase;
  readonly receiptCode: string;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly appealAvailable: boolean;
  readonly classificationDispute: boolean;
};

/** Server error envelope (mirrors web's `jsonError` shape). */
export type CorrectionErrorEnvelope = {
  readonly error: string;
  readonly reason?: string;
  readonly issues?: readonly { readonly field: string; readonly message: string }[];
};

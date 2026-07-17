/**
 * REAL roster entry: citation link-health sweep (BB-083). Wraps `@black-book/domain`'s citation
 * link-health / repair-ladder logic (packages/domain/src/citations/) — the pure classification,
 * retry-before-dead state machine, and repair ladder all live there and are unit-tested there
 * (packages/domain/src/citations/*.test.ts). This file is the thin adapter layer that:
 *
 *   (a) performs the actual BB-030-safe re-verification fetch through
 *       `@black-book/security`'s `executeSafeFetch`, since `@black-book/domain` cannot depend on
 *       `@black-book/security` (security depends on domain; the reverse edge would be a circular
 *       workspace dependency — see packages/domain/src/citations/link-health.ts's module doc for
 *       the same constraint elsewhere in this bead). `packages/config` has no such constraint, so
 *       this is the one place BB-083's real network wiring happens. The Node DNS/HTTP transport
 *       below intentionally mirrors `packages/operator-cli/src/fetch.ts`'s
 *       `nodeResolveHost`/`nodePinnedTransport` (the only other real BB-030 Node transport in
 *       this repo) rather than inventing a third shape — `packages/config` does not depend on
 *       `@black-book/operator-cli` (that dependency direction would be backwards: a CLI package
 *       depending on it, not a scheduled-job framework), so this is a deliberate, small,
 *       documented near-duplicate rather than a new cross-package edge.
 *
 *   (b) enforces the ONE pre-approved automatic public effect this job may make. The roster
 *       entry's `publicEffect` is exactly `'link-repair-archived-copy'` — not a general
 *       "link repair" catch-all (see ../types.ts's `ALLOWED_AUTOMATIC_PUBLIC_EFFECTS`). So this
 *       job automatically applies only the repair ladder's step 2 (wayback_swap: swapping a dead
 *       citation's primary link to an *already-stored* Wayback capture) and step 4 (dead_mark, a
 *       status flag, not a link rewrite). Steps 1 (permanent-redirect update) and 3 (retroactive
 *       Save Page Now, which mints a brand-new archive.org capture) are computed via the same
 *       domain-layer repair ladder and returned as PROPOSED repairs for a human/reviewer to apply
 *       through a separate, explicit action — matching BB-084's "automation proposes, humans
 *       dispose" operating principle. The one applied write (wayback_swap) still goes through
 *       `assertScheduledJobOperationAllowed` before being applied, exactly like every other
 *       scheduled-job write with a declared public effect.
 */
import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  executeSafeFetch,
  type PinnedTransport,
  type PinnedTransportResponse,
  type ResolveHost,
  type SafeFetchDependencies,
} from '@black-book/security';
import {
  advanceLinkHealthState,
  applyRepairLadder,
  classifyLinkCheckAttempt,
  DEFAULT_MAX_RETRIES_BEFORE_DEAD,
  type Citation,
  type LinkCheckClassification,
  type LinkCheckFetchResult,
  type LinkHealthState,
  type SpnCaptureOutcome,
} from '@black-book/domain';
import { assertScheduledJobOperationAllowed } from '../publish-guard.js';
import { DEFAULT_SCHEDULED_JOBS } from '../roster.js';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';
import type { ScheduledJobDefinition } from '../types.js';

export const CITATION_LINK_HEALTH_SWEEP_JOB_ID = 'citation-link-health-sweep';

/** Resolves a hostname via the real system resolver — mirrors operator-cli's `nodeResolveHost`. */
export const nodeResolveHost: ResolveHost = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }));
};

function normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return normalized;
}

/** Connects directly to `pinnedAddress` — mirrors operator-cli's `nodePinnedTransport`. */
export const nodePinnedTransport: PinnedTransport = (pinnedRequest) =>
  new Promise<PinnedTransportResponse>((resolve, reject) => {
    const target = new URL(pinnedRequest.url);
    const requester = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const clientRequest = requester(
      {
        host: pinnedRequest.pinnedAddress,
        port: pinnedRequest.port,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers: pinnedRequest.headers,
        servername: target.protocol === 'https:' ? pinnedRequest.hostname : undefined,
        signal: pinnedRequest.signal,
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          headers: normalizeHeaders(response.headers),
          remoteAddress: clientRequest.socket?.remoteAddress ?? pinnedRequest.pinnedAddress,
          body: response,
        });
      },
    );
    clientRequest.on('error', reject);
    clientRequest.end();
  });

/**
 * Wraps a `PinnedTransport` to additionally record every hop's HTTP status. `executeSafeFetch`'s
 * own return type discards per-hop status codes (see packages/domain/src/citations/
 * link-health.ts's disclosed gap) — this is how the real fetcher below recovers `httpStatus`
 * (final hop) and `permanentRedirect` (whether the *first* hop was 301/308) without modifying
 * BB-030 itself.
 */
function withStatusCapture(base: PinnedTransport): { transport: PinnedTransport; statuses: () => readonly number[] } {
  const statuses: number[] = [];
  const transport: PinnedTransport = async (request) => {
    const response = await base(request);
    statuses.push(response.status);
    return response;
  };
  return { transport, statuses: () => statuses };
}

/**
 * The real BB-030-backed link-health fetcher: performs one SSRF-safe re-verification fetch and
 * adapts `executeSafeFetch`'s result into the `LinkCheckFetchResult` port
 * (packages/domain/src/citations/link-health.ts) that the pure classifier consumes.
 */
export async function checkCitationLinkThroughSafeFetch(
  url: string,
  dependencies: Partial<SafeFetchDependencies> = {},
): Promise<LinkCheckFetchResult> {
  const { transport, statuses } = withStatusCapture(dependencies.transport ?? nodePinnedTransport);
  const result = await executeSafeFetch(url, {
    resolveHost: dependencies.resolveHost ?? nodeResolveHost,
    transport,
    ...(dependencies.parser ? { parser: dependencies.parser } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });

  const seen = statuses();
  const finalStatus = seen.at(-1);
  const permanentRedirect = seen.length > 1 && (seen[0] === 301 || seen[0] === 308);

  if (result.ok) {
    return {
      ok: true,
      finalUrl: result.finalUrl,
      redirectCount: result.redirectCount,
      contentHash: result.contentHash,
      ...(finalStatus !== undefined ? { httpStatus: finalStatus } : {}),
      ...(result.redirectCount > 0 ? { permanentRedirect } : {}),
    };
  }
  return {
    ok: false,
    reason: result.reason,
    ...(finalStatus !== undefined ? { httpStatus: finalStatus } : {}),
  };
}

export type CitationLinkHealthCheckInput = {
  readonly citation: Citation;
  readonly state: LinkHealthState;
};

export type CitationLinkHealthRepair = {
  readonly step: 'permanent_redirect' | 'wayback_swap' | 'retroactive_spn' | 'dead_mark';
  readonly citation: Citation;
};

export type CitationLinkHealthCheckOutcome = {
  readonly citationId: string;
  readonly skipped?: 'offline_citation_no_url_to_check';
  readonly classification?: LinkCheckClassification;
  readonly state: LinkHealthState;
  /** Automatically committed — always exactly the roster's declared 'link-repair-archived-copy'
   *  effect (wayback_swap) or the non-effect dead_mark status flag. */
  readonly appliedRepair?: CitationLinkHealthRepair;
  /** Computed by the same repair ladder but NOT auto-applied — outside this job's declared
   *  public effect; a human/reviewer action must apply these separately. */
  readonly proposedRepair?: CitationLinkHealthRepair;
  readonly flaggedForDriftReview: boolean;
};

export type CitationLinkHealthSweepJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly checks: readonly CitationLinkHealthCheckInput[];
  /** Defaults to the real BB-030-backed fetcher; tests inject a fake. */
  readonly fetchLink?: (url: string) => Promise<LinkCheckFetchResult>;
  readonly attemptSpn: (url: string) => Promise<SpnCaptureOutcome>;
  readonly maxRetriesBeforeDead?: number;
};

export type CitationLinkHealthSweepJobResult = {
  readonly run: JobRunRecord;
  readonly outcomes: readonly CitationLinkHealthCheckOutcome[];
  readonly summary: {
    readonly checked: number;
    readonly alive: number;
    readonly redirected: number;
    readonly drifted: number;
    readonly dead: number;
    readonly repairsApplied: number;
    readonly repairsProposed: number;
    readonly flaggedForDriftReview: number;
  };
};

function citationUrl(citation: Citation): string | undefined {
  return citation.location.kind === 'url' ? citation.location.url : undefined;
}

function requireJobDefinition(): ScheduledJobDefinition {
  const definition = DEFAULT_SCHEDULED_JOBS.find((job) => job.id === CITATION_LINK_HEALTH_SWEEP_JOB_ID);
  if (!definition) {
    throw new Error(`Scheduled job "${CITATION_LINK_HEALTH_SWEEP_JOB_ID}" is not registered in the roster`);
  }
  return definition;
}

const NEVER_ATTEMPT_SPN: (url: string) => Promise<SpnCaptureOutcome> = async () => ({
  ok: false,
  reason: 'not_attempted_this_step_does_not_require_spn',
});

/**
 * Runs one scheduled sweep over the supplied citation checks. Pure aside from the injected
 * `fetchLink`/`attemptSpn` I/O ports — the classification, retry state machine, and repair-ladder
 * ordering are entirely `@black-book/domain`'s tested logic; this function only sequences calls
 * to it and decides which resulting repair step is allowed to auto-commit (see module doc).
 */
export async function runCitationLinkHealthSweepJob(
  input: CitationLinkHealthSweepJobInput,
): Promise<CitationLinkHealthSweepJobResult> {
  const started = startJobRun({
    jobId: CITATION_LINK_HEALTH_SWEEP_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const jobDefinition = requireJobDefinition();
  const fetchLink = input.fetchLink ?? checkCitationLinkThroughSafeFetch;
  const maxRetriesBeforeDead = input.maxRetriesBeforeDead ?? DEFAULT_MAX_RETRIES_BEFORE_DEAD;

  const outcomes: CitationLinkHealthCheckOutcome[] = [];
  for (const check of input.checks) {
    const url = citationUrl(check.citation);
    if (!url) {
      outcomes.push({
        citationId: check.citation.id,
        skipped: 'offline_citation_no_url_to_check',
        state: check.state,
        flaggedForDriftReview: false,
      });
      continue;
    }

    const fetchResult = await fetchLink(url);
    const classification = classifyLinkCheckAttempt({
      fetch: fetchResult,
      ...(check.citation.capture.contentHash ? { capturedContentHash: check.citation.capture.contentHash } : {}),
    });
    const nextState = advanceLinkHealthState(check.state, classification, {
      checkedAt: input.completedAt,
      maxRetriesBeforeDead,
    });

    let appliedRepair: CitationLinkHealthRepair | undefined;
    let proposedRepair: CitationLinkHealthRepair | undefined;

    if (classification.status === 'redirected' && classification.permanentRedirect) {
      // Step 1 is always computed but never auto-committed here — see module doc.
      const outcome = await applyRepairLadder({
        citation: check.citation,
        classification,
        attemptSpn: NEVER_ATTEMPT_SPN,
        now: input.completedAt,
      });
      proposedRepair = { step: 'permanent_redirect', citation: outcome.citation };
    } else if (nextState.status === 'dead') {
      // A retry-exhausted 'pending_retry' classification still means "dead" for the ladder,
      // even though this attempt's own classification wasn't an explicit dead signal.
      const deadClassification: Pick<LinkCheckClassification, 'status' | 'permanentRedirect' | 'redirectTarget'> =
        classification.status === 'dead' ? classification : { status: 'dead' };
      const hasWaybackCapture = Boolean(check.citation.capture.waybackCaptureUrl);

      if (hasWaybackCapture) {
        assertScheduledJobOperationAllowed({
          job: jobDefinition,
          attempt: { operation: 'repair_citation_link_archived_copy', target: check.citation.id },
        });
        const outcome = await applyRepairLadder({
          citation: check.citation,
          classification: deadClassification,
          attemptSpn: NEVER_ATTEMPT_SPN,
          now: input.completedAt,
        });
        appliedRepair = { step: 'wayback_swap', citation: outcome.citation };
      } else {
        const outcome = await applyRepairLadder({
          citation: check.citation,
          classification: deadClassification,
          attemptSpn: input.attemptSpn,
          now: input.completedAt,
        });
        if (outcome.step === 'retroactive_spn') {
          proposedRepair = { step: 'retroactive_spn', citation: outcome.citation };
        } else {
          // dead_mark: a status flag, not a link rewrite — always safe to auto-commit.
          appliedRepair = { step: 'dead_mark', citation: outcome.citation };
        }
      }
    }

    outcomes.push({
      citationId: check.citation.id,
      classification,
      state: nextState,
      ...(appliedRepair ? { appliedRepair } : {}),
      ...(proposedRepair ? { proposedRepair } : {}),
      flaggedForDriftReview: classification.drift?.flaggedForReview ?? false,
    });
  }

  const summary = {
    checked: outcomes.length,
    alive: outcomes.filter((o) => o.classification?.status === 'alive').length,
    redirected: outcomes.filter((o) => o.classification?.status === 'redirected').length,
    drifted: outcomes.filter((o) => o.classification?.status === 'drifted').length,
    dead: outcomes.filter((o) => o.state.status === 'dead').length,
    repairsApplied: outcomes.filter((o) => o.appliedRepair).length,
    repairsProposed: outcomes.filter((o) => o.proposedRepair).length,
    flaggedForDriftReview: outcomes.filter((o) => o.flaggedForDriftReview).length,
  };

  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.checks.length,
    itemsProcessed: outcomes.length,
    issues: outcomes
      .filter((o) => o.flaggedForDriftReview || o.proposedRepair)
      .map((o) => `${o.citationId}:${o.proposedRepair ? o.proposedRepair.step : 'content_drift'}`),
  });

  return { run, outcomes, summary };
}

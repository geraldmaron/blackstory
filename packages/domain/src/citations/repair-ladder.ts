/**
 * Automatic repair ladder (BB-083 acceptance criterion 3), applied in a fixed order:
 *   1. permanent_redirect — follow and record a permanent redirect to its new URL.
 *   2. wayback_swap       — swap the primary public link to the stored Wayback capture; the
 *                            original URL is preserved as "originally published at", never
 *                            discarded.
 *   3. retroactive_spn    — if no capture exists yet, attempt a retroactive Save Page Now
 *                            (./spn-client.ts) and swap to that fresh capture on success.
 *   4. dead_mark          — only once none of the above apply/succeed, mark the citation dead.
 *
 * `decideRepairLadderStep` is the pure, synchronous priority decision (no I/O — see
 * repair-ladder.test.ts for the explicit order proof). `applyRepairLadder` is the small
 * orchestrator that additionally attempts the one step requiring I/O (retroactive_spn) through
 * an injected port and falls through to dead_mark on failure, never throwing for an ordinary
 * "nothing left to try" outcome.
 */
import type { Citation, CitationLocation } from './citation.js';
import type { LinkCheckClassification } from './link-health.js';
import type { SpnCaptureOutcome } from './spn-client.js';

export const REPAIR_LADDER_STEPS = [
  'permanent_redirect',
  'wayback_swap',
  'retroactive_spn',
  'dead_mark',
] as const;
export type RepairLadderStep = (typeof REPAIR_LADDER_STEPS)[number];

export type RepairLadderDecisionInput = {
  readonly classification: Pick<LinkCheckClassification, 'status' | 'permanentRedirect'>;
  readonly hasWaybackCapture: boolean;
};

/**
 * Pure priority decision, no I/O. Only steps 1, 2, and the *choice* to attempt step 3 are
 * decidable up front — whether step 3 actually succeeds (and thus whether step 4 is reached)
 * requires the async attempt in `applyRepairLadder`.
 */
export function decideRepairLadderStep(input: RepairLadderDecisionInput): RepairLadderStep {
  if (input.classification.status === 'redirected' && input.classification.permanentRedirect) {
    return 'permanent_redirect';
  }
  if (input.classification.status === 'dead') {
    return input.hasWaybackCapture ? 'wayback_swap' : 'retroactive_spn';
  }
  throw new Error(
    `decideRepairLadderStep called for a status that needs no repair: ${input.classification.status}`,
  );
}

export type RepairLadderOutcome = {
  readonly step: RepairLadderStep;
  readonly citation: Citation;
};

function originalUrlOf(citation: Citation): string | undefined {
  return citation.location.kind === 'url' ? citation.location.url : undefined;
}

function urlLocation(url: string): CitationLocation {
  return { kind: 'url', url };
}

/**
 * Executes the repair ladder for one citation, in the fixed order documented above.
 * `attemptSpn` is invoked only when the ladder reaches step 3 (dead, no Wayback capture yet
 * exists) — never for a redirect or a wayback_swap outcome, and never more than once per call.
 */
export async function applyRepairLadder(input: {
  readonly citation: Citation;
  readonly classification: Pick<
    LinkCheckClassification,
    'status' | 'permanentRedirect' | 'redirectTarget'
  >;
  readonly attemptSpn: (sourceUrl: string) => Promise<SpnCaptureOutcome>;
  readonly now: string;
}): Promise<RepairLadderOutcome> {
  const { citation, classification, now } = input;
  const originalUrl = originalUrlOf(citation);

  if (classification.status === 'redirected' && classification.permanentRedirect) {
    if (!classification.redirectTarget) {
      throw new Error('A permanent-redirect classification requires a redirectTarget');
    }
    return {
      step: 'permanent_redirect',
      citation: {
        ...citation,
        location: urlLocation(classification.redirectTarget),
        ...(citation.originallyPublishedAtUrl !== undefined
          ? { originallyPublishedAtUrl: citation.originallyPublishedAtUrl }
          : originalUrl !== undefined
            ? { originallyPublishedAtUrl: originalUrl }
            : {}),
        linkStatus: 'alive',
        linkStatusAsOf: now,
        updatedAt: now,
      },
    };
  }

  if (classification.status !== 'dead') {
    throw new Error(`applyRepairLadder called for a status that needs no repair: ${classification.status}`);
  }

  if (citation.capture.waybackCaptureUrl) {
    return {
      step: 'wayback_swap',
      citation: {
        ...citation,
        location: urlLocation(citation.capture.waybackCaptureUrl),
        ...(citation.originallyPublishedAtUrl !== undefined
          ? { originallyPublishedAtUrl: citation.originallyPublishedAtUrl }
          : originalUrl !== undefined
            ? { originallyPublishedAtUrl: originalUrl }
            : {}),
        linkStatus: 'dead',
        linkStatusAsOf: now,
        updatedAt: now,
      },
    };
  }

  const spnOutcome: SpnCaptureOutcome = originalUrl
    ? await input.attemptSpn(originalUrl)
    : { ok: false, reason: 'no_url_to_capture' };

  if (spnOutcome.ok) {
    return {
      step: 'retroactive_spn',
      citation: {
        ...citation,
        capture: {
          ...citation.capture,
          waybackCaptureUrl: spnOutcome.waybackCaptureUrl,
          waybackCapturedAt: spnOutcome.capturedAt,
        },
        location: urlLocation(spnOutcome.waybackCaptureUrl),
        ...(citation.originallyPublishedAtUrl !== undefined
          ? { originallyPublishedAtUrl: citation.originallyPublishedAtUrl }
          : originalUrl !== undefined
            ? { originallyPublishedAtUrl: originalUrl }
            : {}),
        linkStatus: 'dead',
        linkStatusAsOf: now,
        updatedAt: now,
      },
    };
  }

  return {
    step: 'dead_mark',
    citation: { ...citation, linkStatus: 'dead', linkStatusAsOf: now, updatedAt: now },
  };
}

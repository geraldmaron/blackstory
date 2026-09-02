/**
 * Pure gate + plan-row logic for pin-commons-primary-images.ts (repo-4vuf, pin-and-serve).
 *
 * Extracted so the dignity/place gates and the pin-plan row shape are unit-testable without
 * a dry-run file, a live database, or a network call. Mirrors dry-run-commons-qid-leftover.ts's
 * DIGNITY_CLASSES set and lynching_ prefix rule (repo-n7p6.7.1) — this module reapplies both as
 * a second, independent check on the dry-run's own output rather than trusting its `dignityHold`
 * field unexamined, since a bad or hand-edited `--from` file is the input this gate exists to
 * catch.
 */

/** Sensitivity classes that hold a person's photo out of auto-pinning (see dry-run script). */
export const DIGNITY_CLASSES = new Set([
  'violence_associated',
  'perpetrator_associated',
  'contested_legacy',
  'enslaver_or_segregationist',
]);

/** One `auto_propose` row from dry-run-commons-qid-leftover.ts's `autoProposeAll` array. */
export type CommonsAutoProposeRow = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind?: string;
  readonly outcome: string;
  readonly fileTitle?: string;
  readonly commonsPageUrl?: string;
  readonly sourceImageUrl?: string;
  readonly alt?: string;
  readonly credit?: string;
  readonly rightsStatus?: 'public_domain' | 'licensed' | 'fair_use';
  readonly licenseShortName?: string;
  readonly wikidataId?: string;
  readonly dignityHold?: string;
  readonly sensitivity?: readonly { readonly class?: string }[];
};

export type PinGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'dignity_hold' | 'place_kind' | 'incomplete_row' };

/**
 * Re-derive the dignity hold from a row's own fields (not just its precomputed
 * `dignityHold`), so a `--from` file edited by hand still gets the real check.
 */
export function dignityHoldFor(row: CommonsAutoProposeRow): string | undefined {
  if (row.dignityHold) return row.dignityHold;
  if (row.entityId.startsWith('lynching_')) return 'lynching_prefix';
  const hit = row.sensitivity?.find((s) => s.class && DIGNITY_CLASSES.has(s.class));
  return hit?.class;
}

/** Gate a single dry-run row for the pin plan. Places are held unless `allowPlaces`. */
export function evaluatePinGate(
  row: CommonsAutoProposeRow,
  options: { readonly allowPlaces: boolean } = { allowPlaces: false },
): PinGateResult {
  if (row.outcome !== 'auto_propose') {
    return { ok: false, reason: 'incomplete_row' };
  }
  if (dignityHoldFor(row)) {
    return { ok: false, reason: 'dignity_hold' };
  }
  if (row.kind === 'place' && !options.allowPlaces) {
    return { ok: false, reason: 'place_kind' };
  }
  if (!row.fileTitle || !row.alt || !row.credit || !row.rightsStatus) {
    return { ok: false, reason: 'incomplete_row' };
  }
  return { ok: true };
}

/** One row of the pin plan output (repo-4vuf task 5 shape). */
export type PinPlanRow = {
  readonly entityId: string;
  readonly url: string;
  readonly fileTitle: string;
  readonly sha1?: string;
  readonly license?: string;
  readonly credit: string;
  readonly sourcePageUrl: string;
  readonly alt: string;
};

/**
 * Build the plan row for a gated-in entity. `thumbUrl` is the pre-built
 * `commonsPinThumbnailUrl(fileTitle)` result (kept as an input so this stays pure); `sha1`
 * is optional because it may not have been fetched yet (see the script's metadata step).
 */
export function buildPinPlanRow(input: {
  readonly row: CommonsAutoProposeRow;
  readonly thumbUrl: string;
  readonly sha1?: string;
}): PinPlanRow {
  const { row, thumbUrl, sha1 } = input;
  if (!row.fileTitle || !row.alt || !row.credit || !row.commonsPageUrl) {
    throw new Error(
      `buildPinPlanRow: row ${row.entityId} is missing a required field (fileTitle/alt/credit/commonsPageUrl) — call evaluatePinGate first`,
    );
  }
  return {
    entityId: row.entityId,
    url: thumbUrl,
    fileTitle: row.fileTitle,
    ...(sha1 !== undefined ? { sha1 } : {}),
    ...(row.licenseShortName !== undefined ? { license: row.licenseShortName } : {}),
    credit: row.credit,
    sourcePageUrl: row.commonsPageUrl,
    alt: row.alt,
  };
}

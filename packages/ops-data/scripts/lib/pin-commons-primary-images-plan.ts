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
  readonly kind?: string | undefined;
  readonly outcome: string;
  readonly fileTitle?: string | undefined;
  readonly commonsPageUrl?: string | undefined;
  readonly sourceImageUrl?: string | undefined;
  readonly alt?: string | undefined;
  readonly credit?: string | undefined;
  readonly rightsStatus?: 'public_domain' | 'licensed' | 'fair_use' | undefined;
  readonly licenseShortName?: string | undefined;
  readonly wikidataId?: string | undefined;
  readonly dignityHold?: string | undefined;
  readonly sensitivity?: readonly { readonly class?: string | undefined }[] | undefined;
  /** Set when the source plan already fetched Commons imageinfo sha1 (e.g. the NRHP /
   * QID-leftover lanes' evaluateCommonsMediaPropose output) — see buildPinPlanRow. */
  readonly sha1?: string | undefined;
};

/** One `--from` file's parsed JSON — matches dry-run-commons-qid-leftover.ts's
 * (autoProposeAll/autoProposePeople) and resolve-nrhp-commons-images.ts's (proposes) shapes. */
export type CommonsPinSourcePayload = {
  readonly autoProposeAll?: readonly CommonsAutoProposeRow[];
  readonly autoProposePeople?: readonly CommonsAutoProposeRow[];
  readonly proposes?: readonly CommonsAutoProposeRow[];
};

/** Pick one payload's candidate array: autoProposeAll (QID-leftover lane) wins over
 * autoProposePeople, then falls back to proposes (NRHP lane's plan shape). */
export function candidatesFromPayload(
  payload: CommonsPinSourcePayload,
): readonly CommonsAutoProposeRow[] {
  return payload.autoProposeAll ?? payload.autoProposePeople ?? payload.proposes ?? [];
}

/**
 * Merge multiple `--from` payloads' candidate rows into one list, deduping by entityId —
 * first payload wins on a collision. The QID-leftover (people/institutions) and NRHP (places)
 * lanes cover disjoint entity sets in practice, but a dedupe keeps a re-run or an overlapping
 * input file safe rather than silently double-counting or double-processing an entity.
 */
export function mergeCandidatePayloads(
  payloads: readonly CommonsPinSourcePayload[],
): readonly CommonsAutoProposeRow[] {
  const seen = new Set<string>();
  const merged: CommonsAutoProposeRow[] = [];
  for (const payload of payloads) {
    for (const row of candidatesFromPayload(payload)) {
      if (seen.has(row.entityId)) continue;
      seen.add(row.entityId);
      merged.push(row);
    }
  }
  return merged;
}

export type PinGateResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'dignity_hold' | 'place_kind' | 'incomplete_row' | 'depiction_hold';
      /** For `depiction_hold`: which rule fired, for the operator report. */
      readonly detail?: string;
    };

/**
 * Refuse an image because of WHAT IT DEPICTS, which is the check this gate did not have.
 *
 * `dignityHoldFor` reads the ENTITY: its sensitivity classes and its id prefix. Nothing read the
 * IMAGE. So a bulk pin on 2026-09-02 put a statue on Daisy Bates, a wall mural on Rebecca G.
 * Howard, and — the case this exists for — a group photograph of the four children murdered in
 * the 16th Street Baptist Church bombing onto two of those children's own records, as their solo
 * portrait. Every one of those rows passed the entity gate, because there was never anything
 * wrong with the entity.
 *
 * Two families of refusal, and they fail for different reasons:
 *
 *  - AN OBJECT, not the person. A statue, bust, mural, plaque, headstone or postage stamp OF
 *    someone is not a photograph of them, and presenting it as one tells the reader the archive
 *    has a likeness it does not have.
 *  - MORE THAN ONE PERSON. A class photograph, a family photograph, a line-up captioned "from
 *    left", or a file whose own title opens "Unidentified man" is not this subject's portrait.
 *    Cropping does not fix it: "Cynthia Wesley (cropped).jpg" carries the description "The four
 *    girls killed during the 16th Street Baptist Church bombing", so the crop was of the group
 *    and not to the individual. Treat `(cropped)` as no evidence either way and judge the
 *    description.
 *
 * FAILS CLOSED BY DESIGN. It reads the file title and whatever description text the caller has,
 * so a row with no description is judged on its title alone and an ambiguous one is refused. A
 * refused photo costs the reader a portrait; an accepted one can put four murdered children on a
 * page as though each were the subject. Those are not symmetric, which is why the doubt resolves
 * this way. A human can always pin a specific file deliberately.
 */
const DEPICTS_AN_OBJECT =
  /\b(statue|statues|sculpture|sculptural|bust of|monument|memorial to|mural|plaque|historical marker|headstone|gravestone|grave of|tombstone|postage stamp|commemorative stamp|banknote|mosaic|stained[- ]glass)\b/i;

const DEPICTS_A_GROUP =
  /\b(and class|and his class|and her class|and students|with her students|with his students|and parents|and her parents|and his parents|and family|group (?:photo|portrait|of)|from left|left to right|l-?r:|unidentified (?:man|woman|person)|others|crowd|the four girls|team photo)\b/i;

/**
 * Hold reason for a row whose image does not depict the subject alone, or `undefined` to allow.
 *
 * `description` is the Commons `ImageDescription`, which is where the real evidence lives — the
 * title is frequently just the subject's name even when the photograph is of a group.
 */
export function depictionHoldFor(
  row: Pick<CommonsAutoProposeRow, 'fileTitle' | 'alt' | 'kind'>,
  description?: string,
): string | undefined {
  // Only person records carry the "must be a portrait of the subject" expectation. A place's
  // photograph of its own historical marker is the correct image for that place.
  if (row.kind !== undefined && row.kind !== 'person') return undefined;
  const haystack = [row.fileTitle ?? '', row.alt ?? '', description ?? ''].join(' ');
  if (DEPICTS_AN_OBJECT.test(haystack)) return 'depicts_an_object';
  if (DEPICTS_A_GROUP.test(haystack)) return 'depicts_a_group';
  return undefined;
}

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
  options: { readonly allowPlaces: boolean; readonly description?: string } = {
    allowPlaces: false,
  },
): PinGateResult {
  if (row.outcome !== 'auto_propose') {
    return { ok: false, reason: 'incomplete_row' };
  }
  if (dignityHoldFor(row)) {
    return { ok: false, reason: 'dignity_hold' };
  }
  const depiction = depictionHoldFor(row, options.description);
  if (depiction) {
    return { ok: false, reason: 'depiction_hold', detail: depiction };
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
  readonly sha1?: string | undefined;
  readonly license?: string | undefined;
  readonly credit: string;
  readonly sourcePageUrl: string;
  readonly alt: string;
};

/**
 * Build the plan row for a gated-in entity. `thumbUrl` is the pre-built
 * `commonsPinThumbnailUrl(fileTitle)` result (kept as an input so this stays pure); `sha1`
 * is the caller's fallback (e.g. a freshly fetched or cached value) used only when the row
 * itself doesn't already carry one — a row's own `sha1` (set when its source plan already
 * fetched Commons imageinfo) always wins, so the script never re-fetches metadata it has.
 */
export function buildPinPlanRow(input: {
  readonly row: CommonsAutoProposeRow;
  readonly thumbUrl: string;
  readonly sha1?: string;
}): PinPlanRow {
  const { row, thumbUrl, sha1: fallbackSha1 } = input;
  if (!row.fileTitle || !row.alt || !row.credit || !row.commonsPageUrl) {
    throw new Error(
      `buildPinPlanRow: row ${row.entityId} is missing a required field (fileTitle/alt/credit/commonsPageUrl) — call evaluatePinGate first`,
    );
  }
  const sha1 = row.sha1 ?? fallbackSha1;
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

/**
 * Shared ON CONFLICT fragments for `bb_research.landscape_candidates` upserts.
 *
 * A re-stage (running a staging script again after correcting one record) upserts every row in
 * its cohort, including rows that were already accepted and have since been enriched or reviewed
 * by a different, later pass. `entity-enrichment-apply.ts` writes `payload.enrichment` onto rows
 * regardless of which lane staged them, and person-review flows write `payload.personReview` the
 * same way. A staging script that does not itself write those keys must not erase them.
 *
 * `payload = EXCLUDED.payload` replaces the stored payload wholesale, discarding any key another
 * pass wrote after the row was accepted. The fix is to merge instead of replace: each caller names
 * the payload keys it OWNS (exactly the keys it writes into its payload JSON), and on conflict we
 * subtract those owned keys from the stored payload before merging in the new one —
 *
 *   payload = (landscape_candidates.payload - <owned keys as text[]>) || EXCLUDED.payload
 *
 * — so an owned key is refreshed (a correction wins, and a key the caller stopped writing is
 * removed), while a key the caller does not own survives untouched.
 *
 * What a re-stage does to a candidate's review status.
 *
 * Re-staging is how a corrected record reaches readers, so a row whose content actually moved has
 * to go back to `pending` and be looked at again. A row that did not move must not: resetting an
 * accepted candidate that nobody edited would drop already-published records back into the review
 * queue every time one sibling in the cohort is corrected, and the queue would stop meaning
 * anything.
 *
 * The comparison is `IS DISTINCT FROM` rather than `<>` so a null on either side compares as a
 * difference instead of swallowing the row. `payload` is jsonb, whose key order is normalized by
 * the type, so an unchanged payload compares equal however the script serialized it. The payload
 * side of that comparison has to use the same merged expression the SET clause writes — comparing
 * the stored payload against a bare `EXCLUDED.payload` would count a preserved non-owned key (one
 * this caller never wrote and did not touch) as a change on every single re-stage.
 */

const OWNED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;

/** Columns compared, alongside payload, to decide whether a re-staged row actually changed. */
export const DEFAULT_STATUS_COMPARISON_COLUMNS: readonly string[] = [
  'display_name',
  'summary',
  'canonical_url',
  'lat',
  'lng',
  'provenance',
];

function assertValidOwnedKeys(ownedKeys: readonly string[]): void {
  for (const key of ownedKeys) {
    if (!OWNED_KEY_PATTERN.test(key)) {
      throw new Error(
        `landscape-candidate-upsert: owned key ${JSON.stringify(key)} does not match ${OWNED_KEY_PATTERN}`,
      );
    }
  }
}

/**
 * A validated owned-key list rendered as a `text[]` literal, e.g. `ARRAY['city','state']::text[]`.
 * Keys are validated against `/^[A-Za-z][A-Za-z0-9_]*$/` first, so the rendered literal never
 * carries a quote, backslash, or other character that would need escaping.
 */
export function ownedKeysArrayLiteral(ownedKeys: readonly string[]): string {
  assertValidOwnedKeys(ownedKeys);
  if (ownedKeys.length === 0) return 'ARRAY[]::text[]';
  return `ARRAY[${ownedKeys.map((key) => `'${key}'`).join(',')}]::text[]`;
}

/**
 * The merge expression for a payload SET clause: subtract the caller's owned keys from the stored
 * payload, then merge in the new payload. A key the caller does not own survives untouched however
 * many times the row is re-staged; an owned key is fully replaced by whatever EXCLUDED.payload
 * carries this run (including being dropped, if the caller stopped writing it).
 *
 * `excludeFromIncoming` additionally strips keys out of EXCLUDED.payload before the merge. Use
 * this for a key the caller writes with a value that legitimately varies run to run (e.g. a
 * timestamp) where the caller wants to decide separately, with its own CASE expression, whether
 * the new value should win — see stage-inventor-cohort.ts's handling of `personReview`. Such a key
 * must not appear in `ownedKeys`, or it would be dropped by the subtraction and never restored.
 */
export function mergedPayloadSql(
  ownedKeys: readonly string[],
  options?: { readonly excludeFromIncoming?: readonly string[] },
): string {
  const owned = ownedKeysArrayLiteral(ownedKeys);
  const excludeFromIncoming = options?.excludeFromIncoming ?? [];
  const incoming =
    excludeFromIncoming.length === 0
      ? 'EXCLUDED.payload'
      : `(EXCLUDED.payload - ${ownedKeysArrayLiteral(excludeFromIncoming)})`;
  return `(landscape_candidates.payload - ${owned}) || ${incoming}`;
}

/**
 * The `status` SET-clause CASE expression: reset to 'pending' only when a compared column, or the
 * merged payload, actually differs from what is stored. `extraColumns` defaults to the non-payload
 * columns every landscape-candidate stager writes; pass a narrower or wider list when a caller's
 * UPDATE SET touches different columns.
 *
 * `payloadExpr`, when given, is used in place of `mergedPayloadSql(ownedKeys)` for the payload
 * comparison term — pass the caller's own final merged-payload expression here whenever it differs
 * from the plain merge (e.g. because of an `excludeFromIncoming` CASE like personReview's), so the
 * comparison sees exactly what is about to be written rather than a payload that is inflated by
 * every rerun of a churning key.
 */
export function statusOnConflictSql(
  ownedKeys: readonly string[],
  extraColumns: readonly string[] = DEFAULT_STATUS_COMPARISON_COLUMNS,
  payloadExpr?: string,
): string {
  assertValidOwnedKeys(ownedKeys);
  const payloadTerm = payloadExpr ?? mergedPayloadSql(ownedKeys);
  const columnChecks = extraColumns
    .map((column) => `landscape_candidates.${column} IS DISTINCT FROM EXCLUDED.${column}`)
    .join('\n               OR ');
  const columnChecksBlock = columnChecks.length > 0 ? `${columnChecks}\n               OR ` : '';
  return `CASE
             WHEN ${columnChecksBlock}(${payloadTerm}) IS DISTINCT FROM landscape_candidates.payload
             THEN 'pending'
             ELSE landscape_candidates.status
           END`;
}

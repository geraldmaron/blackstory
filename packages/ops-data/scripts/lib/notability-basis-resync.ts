/**
 * The one implementation of the ratified notability-basis merge rule, plus the two staleness
 * tests repo-rm2y measured. `apply-notability-rubric-ruling.ts` (the ruling pass) and
 * `resync-notability-basis.ts` (the standing resync) both call it, so the rule cannot exist twice
 * and drift.
 *
 * WHY A MERGE AND NOT A RECOMPUTE — this is the part that matters, and it is lifted verbatim from
 * the ruling pass that established it.
 *
 * A record's published basis is not always derived from its claims. Earlier passes hand-authored
 * criteria (`fix-civil-rights-leaders-notability-basis.ts`, `fix-person-notability-and-stubs.ts`,
 * `packages/domain/src/seed-campaigns/records.ts`), and nothing in those records' claim text
 * carries the keyword that would reproduce them. A straight recompute — which is what a first
 * draft of the ruling pass did — took `first_to_do_x` off Carter G. Woodson and Hattie McDaniel,
 * `major_honor_or_hall_of_fame` off Denzel Washington, Stevie Wonder and Katherine Johnson, and
 * `movement_significance` off Fred Shuttlesworth and Bayard Rustin. Twenty records in that sample
 * alone, all curated work, all silently replaced by the fallback. Measured corpus-wide on
 * rel_20260723_authority_net_001 (2026-09-12, repo-rm2y): a strict recompute changes 195 records
 * and strips a hand-authored criterion from 47 of them.
 *
 * So: every non-fallback criterion a record already publishes is KEPT. Only the `documented_site`
 * records are up for replacement. The pass can add a criterion and can drop a metadata basis
 * record; it cannot take away a reason a person put there.
 *
 * TWO STALENESS TESTS ON TOP OF THE MERGE (repo-rm2y). Both are provable from the row, neither is
 * a taste call, and neither can reach curated prose:
 *
 *   S1 PROVABLY DANGLING. A published basis record carrying an `evidenceId` that no longer
 *   resolves to any claim the record currently carries is dropped, and the merge then re-adds the
 *   recomputed record(s) for that criterion. These exist because
 *   `fix-civil-rights-leaders-uncorroborated.ts` rewrote summary, claims and claimIds with
 *   hand-written claim ids and recomputed none of the derived fields — the note it left behind is
 *   the record's OLD summary with the literal string "Documented site " on the front of a person.
 *   Three records in the release, all in that one lane.
 *
 *   S2 FORMATTING DRIFT. A published record whose criterion AND sorted `evidenceIds` exactly equal
 *   a recomputed record's, and whose note is identical to the recomputed note after normalization
 *   (see `notesAreSameSentence`), takes the builder's note. This is the "led by: X.. Cited from
 *   nps.gov." / "Is listed on the National Register of Historic Places Quindaro Townsite." shape:
 *   a stored note produced by an older spelling of `buildNotabilityBasisNote`, before the
 *   colon-form lead, the trailing citation and the self-naming display-name object were fixed.
 *
 * The normalization is what makes S2 safe, and it was measured rather than assumed: of the 13
 * candidate refreshes in the release, 12 normalize-equal and one does not —
 * `ent_harriet_tubman_001`'s `first_to_do_x`, a curated sentence about the Combahee River Raid
 * that the builder would have replaced with a different sentence. S2 leaves it alone by
 * construction, which is the same principle the merge rule already encodes.
 *
 * WHAT IS DELIBERATELY LEFT ALONE
 *   - The 67 basis records carrying zero `evidenceIds`. They were hand-authored on purpose
 *     (repo-z1uk, `fix-person-notability-and-stubs.ts`, tradeoff stated in its header). An empty
 *     evidence list vacuously resolves, so S1 never touches them, and no recomputed record shares
 *     their evidence key, so S2 never touches them either.
 *   - Notes that begin "Documented site " and ARE reproducible from a live claim. 313 of the 316
 *     in the release are: the claim's predicate is literally `documented_site` and its object is
 *     the record's own summary, written by `buildReleaseSourceFromLandscape`. That is a
 *     claims-level defect with its own fix; a basis resync reproduces them exactly, and a "no
 *     change" here must not be read as proof they are correct.
 *   - A record whose recompute yields no basis at all. Publishing requires >= 1 basis record; a
 *     row with no evidenced reason is a research gap to fill, not a default to invent — the call
 *     already made for `sundown_crescent_springs_kentucky`.
 *
 * WRITE TARGETS. A released row keeps the same basis in more than one place, and a write that
 * lands on one of them looks applied and changes nothing a reader sees. `applyNotabilityBasisResync`
 * writes all of them in one statement per row:
 *   - `bb_public.release_entities.projection` — `notabilityBasis` + `notabilityLabels`
 *   - `bb_public.release_entities.taxonomy`   — `notabilityLabels`, only where the row already
 *                                               carries that key (other rows never had it)
 *   - `bb_public.search_index.facets`         — `notabilityBasis` + `notabilityLabels`
 * The ruling pass omitted the third, which is part of why 18 rows diverged between the projection
 * and their search facets.
 *
 * `bb_canonical.entities.notability_basis` is NOT written. The incremental publisher inserts it as
 * `'[]'::jsonb` and never updates it on conflict, so it has never been maintained, nothing on any
 * reader path reads it, and it disagrees with the projection on 3,683 of 4,198 released rows.
 * Bringing it into line or deprecating it is its own decision, not a side effect of this pass.
 *
 * Read-only until `applyNotabilityBasisResync` is called: `planNotabilityBasisResync` never writes.
 */
import {
  buildReleaseNotabilityBasis,
  NOTABILITY_RUBRIC,
  type NotabilityBasisRecord,
  type NotabilityCriterion,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from '@repo/domain';

/** The criterion the builder falls back to, and the only one the merge is allowed to replace. */
export const FALLBACK_CRITERION = 'documented_site';

/** Minimal query surface this module needs — satisfied by `pg.Client`, `Pool`, and `PoolClient`. */
export type NotabilityBasisResyncClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: T[]; readonly rowCount?: number | null }>;
};

/**
 * One release row, already decoded. `claims` and `publishedBasis` come from the PROJECTION, never
 * from the `claims` column: `lib/projection-divergence.ts` establishes the projection as the only
 * store public readers touch, and five scripts write `projection.claims` directly. The two are
 * identical on all 4,198 rows today, so reading the projection costs nothing and removes a latent
 * trap.
 */
export type NotabilityBasisResyncRow = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly claims: readonly ReleaseClaimProjection[];
  readonly publishedBasis: readonly NotabilityBasisRecord[];
  readonly publishedLabels: readonly string[];
  /** Whether `taxonomy` already carries `notabilityLabels`; rows without it never get it added. */
  readonly hasTaxonomyLabels: boolean;
  /** Whether the row has a `bb_public.search_index` twin to keep in step. */
  readonly hasSearchIndex: boolean;
};

export type NotabilityBasisNoteRefresh = {
  readonly criterion: NotabilityCriterion;
  readonly before: string;
  readonly after: string;
  readonly evidenceIds: readonly string[];
};

/** Every store this change must land on. Asserted in the plan so a partial write is visible. */
export type NotabilityBasisWriteTarget =
  'release_entities.projection' | 'release_entities.taxonomy' | 'search_index.facets';

export type NotabilityBasisResyncChange = {
  readonly entityId: string;
  readonly displayName: string;
  readonly basisBefore: readonly NotabilityBasisRecord[];
  readonly basisAfter: readonly NotabilityBasisRecord[];
  readonly labelsBefore: readonly string[];
  readonly labelsAfter: readonly string[];
  /** S1: records dropped because an `evidenceId` no longer resolves. */
  readonly droppedDangling: readonly NotabilityBasisRecord[];
  /** S2: notes replaced by the builder's spelling of the same sentence. */
  readonly refreshedNotes: readonly NotabilityBasisNoteRefresh[];
  readonly writeTargets: readonly NotabilityBasisWriteTarget[];
};

export type NotabilityBasisResyncPlan = {
  readonly scanned: number;
  readonly unchanged: number;
  readonly changes: readonly NotabilityBasisResyncChange[];
  /** Records whose merge leaves no basis at all. Reported, never written. */
  readonly wouldEmpty: readonly string[];
  readonly criterionBefore: Readonly<Record<string, number>>;
  readonly criterionAfter: Readonly<Record<string, number>>;
  /** Non-fallback criteria whose corpus-wide count would FALL. Any entry means refuse to write. */
  readonly lostCriteria: readonly string[];
  /** Entity ids that would lose a non-fallback criterion outright. Any entry means refuse. */
  readonly recordsLosingCriterion: readonly string[];
  /** True when either guard tripped. `applyNotabilityBasisResync` throws rather than write. */
  readonly refusesToWrite: boolean;
};

function evidenceKey(evidenceIds: readonly string[]): string {
  return [...evidenceIds].sort().join(',');
}

/**
 * Order-insensitive identity of a basis list, lifted verbatim from the ruling pass so "did this
 * row change" means the same thing in both callers.
 */
export function encodeBasis(records: readonly NotabilityBasisRecord[]): string {
  return JSON.stringify(
    records
      .map((record) => `${record.criterion}|${record.note}|${evidenceKey(record.evidenceIds)}`)
      .sort(),
  );
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Whether two notes are the same sentence differently spelled — the S2 test, and the only thing
 * standing between this pass and a curated sentence.
 *
 * Three normalizations, each one an artifact of a specific older spelling of
 * `buildNotabilityBasisNote` that the current one no longer produces:
 *   - a trailing "Cited from <source>." clause, which the builder's own contract forbids
 *     ("citations stay on evidenceIds; this note does not repeat 'Cited from …'");
 *   - the record's own display name appearing in the note, which the self-naming-object guard now
 *     strips ("Is listed on the National Register of Historic Places Quindaro Townsite.");
 *   - punctuation and case, which covers the colon-form predicate lead ("led by: X." vs
 *     "Led by X.") and a doubled full stop.
 *
 * Everything else — a different verb, a different fact, a different length — survives
 * normalization and the stored note is left alone.
 */
export function notesAreSameSentence(a: string, b: string, displayName: string): boolean {
  return normalizeNote(a, displayName) === normalizeNote(b, displayName);
}

function normalizeNote(note: string, displayName: string): string {
  let text = note.replace(/\s*Cited from\s.*$/iu, '');
  const name = displayName.trim();
  if (name.length > 0) {
    text = text.replace(new RegExp(escapeForRegExp(name), 'giu'), ' ');
  }
  return text.toLowerCase().replace(/[^a-z0-9]+/gu, '');
}

/**
 * The rubric labels a basis list implies. The one derivation, so a row's `notabilityLabels` and
 * the invariant the divergence audit asserts about them cannot be spelled differently.
 */
export function notabilityLabelsForBasis(
  records: readonly NotabilityBasisRecord[],
): readonly string[] {
  return [...new Set(records.map((record) => NOTABILITY_RUBRIC[record.criterion]))];
}

export type NotabilityBasisRowOutcome = {
  readonly merged: readonly NotabilityBasisRecord[];
  readonly droppedDangling: readonly NotabilityBasisRecord[];
  readonly refreshedNotes: readonly NotabilityBasisNoteRefresh[];
  /** `true` when the row is out of scope entirely: no claims, or no recomputable basis. */
  readonly skipped: boolean;
};

/**
 * S1 + S2 + the ratified merge for ONE row. Pure — this is the whole rule, and everything else in
 * this module either feeds it or reports on it.
 */
export function resolveNotabilityBasisForRow(
  row: NotabilityBasisResyncRow,
): NotabilityBasisRowOutcome {
  const published = row.publishedBasis;
  const empty: NotabilityBasisRowOutcome = {
    merged: published,
    droppedDangling: [],
    refreshedNotes: [],
    skipped: true,
  };
  if (row.claims.length === 0) return empty;

  // Only `kind`, `displayName` and `summary` are read by the basis builder on this path.
  const entry = {
    kind: row.kind,
    displayName: row.displayName,
    summary: row.summary,
  } as unknown as ReleaseSourceEntity;
  const recomputed = buildReleaseNotabilityBasis(entry, row.claims);
  // A record the builder can say nothing about is a research gap, not a row to rewrite.
  if (recomputed.length === 0) return empty;

  const claimIds = new Set(row.claims.map((claim) => claim.id));
  const resolves = (record: NotabilityBasisRecord): boolean =>
    record.evidenceIds.every((id) => claimIds.has(id));

  // S1 — an evidenceId that resolves to nothing the record now carries.
  const droppedDangling = published.filter((record) => !resolves(record));
  const survivors = published.filter(resolves);

  // S2 — same criterion, same evidence, same sentence: take the builder's spelling.
  const refreshedNotes: NotabilityBasisNoteRefresh[] = [];
  const refreshed = survivors.map((record) => {
    const candidate = recomputed.find(
      (other) =>
        other.criterion === record.criterion &&
        evidenceKey(other.evidenceIds) === evidenceKey(record.evidenceIds),
    );
    if (candidate === undefined || candidate.note === record.note) return record;
    if (!notesAreSameSentence(record.note, candidate.note, row.displayName)) return record;
    refreshedNotes.push({
      criterion: record.criterion,
      before: record.note,
      after: candidate.note,
      evidenceIds: record.evidenceIds,
    });
    return { ...record, note: candidate.note };
  });

  // The ratified merge, verbatim: keep every non-fallback criterion, fill the rest from the build.
  const keep = refreshed.filter((record) => record.criterion !== FALLBACK_CRITERION);
  const kept = new Set(keep.map((record) => record.criterion));
  const merged = [...keep, ...recomputed.filter((record) => !kept.has(record.criterion))].sort(
    (a, b) => a.criterion.localeCompare(b.criterion),
  );

  return { merged, droppedDangling, refreshedNotes, skipped: false };
}

/**
 * Whether the stored basis on this row is already what the rule produces. The standing gate the
 * divergence audit asks; a row out of scope (no claims, nothing recomputable) is never "stale".
 */
export function notabilityBasisIsConverged(row: NotabilityBasisResyncRow): boolean {
  const outcome = resolveNotabilityBasisForRow(row);
  if (outcome.skipped) return true;
  if (outcome.merged.length === 0) return true;
  return encodeBasis(row.publishedBasis) === encodeBasis(outcome.merged);
}

/** Computes what would change across the whole release. Never writes. */
export function planNotabilityBasisResync(
  rows: readonly NotabilityBasisResyncRow[],
): NotabilityBasisResyncPlan {
  const changes: NotabilityBasisResyncChange[] = [];
  const wouldEmpty: string[] = [];
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const recordsLosingCriterion: string[] = [];
  let unchanged = 0;

  const count = (target: Map<string, number>, records: readonly NotabilityBasisRecord[]): void => {
    for (const record of records)
      target.set(record.criterion, (target.get(record.criterion) ?? 0) + 1);
  };

  for (const row of rows) {
    count(before, row.publishedBasis);
    const outcome = resolveNotabilityBasisForRow(row);

    if (outcome.skipped) {
      count(after, row.publishedBasis);
      continue;
    }
    count(after, outcome.merged);
    if (outcome.merged.length === 0) {
      // Publishing requires >= 1 basis record. A row with no evidenced reason is a research gap
      // to fill, not a default to invent — the same call already made for Crescent Springs.
      wouldEmpty.push(`${row.displayName} (${row.entityId})`);
      continue;
    }
    if (encodeBasis(row.publishedBasis) === encodeBasis(outcome.merged)) {
      unchanged += 1;
      continue;
    }

    // Per-record anti-regression for S1, which is the only step that can remove a record: a
    // criterion the row published must still be published, unless it is the fallback the merge is
    // allowed to replace. The corpus-wide guard below cannot see this, because another row gaining
    // the same criterion would mask it.
    const criteriaBefore = new Set(
      row.publishedBasis
        .map((record) => record.criterion)
        .filter((criterion) => criterion !== FALLBACK_CRITERION),
    );
    const criteriaAfter = new Set(outcome.merged.map((record) => record.criterion));
    if ([...criteriaBefore].some((criterion) => !criteriaAfter.has(criterion))) {
      recordsLosingCriterion.push(row.entityId);
    }

    const writeTargets: NotabilityBasisWriteTarget[] = ['release_entities.projection'];
    if (row.hasTaxonomyLabels) writeTargets.push('release_entities.taxonomy');
    if (row.hasSearchIndex) writeTargets.push('search_index.facets');

    changes.push({
      entityId: row.entityId,
      displayName: row.displayName,
      basisBefore: row.publishedBasis,
      basisAfter: outcome.merged,
      labelsBefore: row.publishedLabels,
      labelsAfter: notabilityLabelsForBasis(outcome.merged),
      droppedDangling: outcome.droppedDangling,
      refreshedNotes: outcome.refreshedNotes,
      writeTargets,
    });
  }

  // A criterion that disappears from a record is the failure mode this rule is shaped around, so
  // it is asserted rather than trusted: the merge cannot drop one, and if the count ever falls for
  // anything but the fallback, something upstream changed and the run must not write.
  const criteria = [...new Set([...before.keys(), ...after.keys()])].sort();
  const lostCriteria = criteria.filter(
    (criterion) =>
      criterion !== FALLBACK_CRITERION &&
      (after.get(criterion) ?? 0) < (before.get(criterion) ?? 0),
  );

  return {
    scanned: rows.length,
    unchanged,
    changes,
    wouldEmpty,
    criterionBefore: Object.fromEntries(before),
    criterionAfter: Object.fromEntries(after),
    lostCriteria,
    recordsLosingCriterion,
    refusesToWrite: lostCriteria.length > 0 || recordsLosingCriterion.length > 0,
  };
}

export function formatNotabilityBasisResyncPlan(
  plan: NotabilityBasisResyncPlan,
): readonly string[] {
  const lines = [
    `Records: ${plan.scanned} | already correct: ${plan.unchanged} | to change: ${plan.changes.length}`,
    `Dangling basis records dropped: ${plan.changes.reduce((n, c) => n + c.droppedDangling.length, 0)}`,
    `Notes refreshed to the builder's spelling: ${plan.changes.reduce((n, c) => n + c.refreshedNotes.length, 0)}`,
    `Records whose notabilityLabels change value: ${
      plan.changes.filter(
        (c) =>
          JSON.stringify([...c.labelsBefore].sort()) !== JSON.stringify([...c.labelsAfter].sort()),
      ).length
    }`,
  ];
  const criteria = [
    ...new Set([...Object.keys(plan.criterionBefore), ...Object.keys(plan.criterionAfter)]),
  ].sort();
  lines.push('', 'criterion                        before      after');
  for (const criterion of criteria) {
    const b = plan.criterionBefore[criterion] ?? 0;
    const a = plan.criterionAfter[criterion] ?? 0;
    const arrow = a > b ? '  +' : a < b ? '  -' : '   ';
    lines.push(
      `  ${criterion.padEnd(30)} ${String(b).padStart(6)} ${String(a).padStart(10)}${arrow}`,
    );
  }
  if (plan.wouldEmpty.length > 0) {
    lines.push(
      '',
      'NOT WRITTEN — no evidenced reason for inclusion at all. Research, not rewrite:',
    );
    for (const entry of plan.wouldEmpty) lines.push(`  ${entry}`);
  }
  if (plan.lostCriteria.length > 0) {
    lines.push(
      '',
      `REFUSING TO WRITE — these criteria lost records: ${plan.lostCriteria.join(', ')}`,
      'The merge is supposed to make that impossible. Investigate before applying.',
    );
  }
  if (plan.recordsLosingCriterion.length > 0) {
    lines.push(
      '',
      `REFUSING TO WRITE — these records lose a criterion outright: ${plan.recordsLosingCriterion.join(', ')}`,
      'Dropping a dangling record is only safe when the rebuild re-states its criterion.',
    );
  }
  return lines;
}

const PROJECTION_AND_TAXONOMY_SQL = `
  UPDATE bb_public.release_entities
     SET projection = COALESCE(projection, '{}'::jsonb)
           || jsonb_build_object('notabilityBasis', $1::jsonb, 'notabilityLabels', $2::jsonb),
         taxonomy = CASE
           WHEN taxonomy ? 'notabilityLabels'
             THEN taxonomy || jsonb_build_object('notabilityLabels', $2::jsonb)
           ELSE taxonomy END
   WHERE release_id = $3 AND entity_id = $4
`;

/**
 * The copy the ruling pass omitted. `search_index.facets` is what the search surface reads, and a
 * projection-only write is exactly the "looks applied, changes nothing a reader sees" failure this
 * bead was filed about.
 */
const SEARCH_INDEX_SQL = `
  UPDATE bb_public.search_index
     SET facets = jsonb_set(
           jsonb_set(COALESCE(facets, '{}'::jsonb), '{notabilityBasis}', $1::jsonb, true),
           '{notabilityLabels}', $2::jsonb, true)
   WHERE release_id = $3 AND entity_id = $4
`;

export type NotabilityBasisResyncResult = {
  readonly projectionRows: number;
  readonly searchIndexRows: number;
};

/**
 * Applies a previously computed plan. The caller owns the transaction; every copy for one entity
 * is written before the next entity is touched, so a failure cannot leave one store ahead of
 * another within a row.
 */
export async function applyNotabilityBasisResync(
  client: NotabilityBasisResyncClient,
  plan: NotabilityBasisResyncPlan,
  releaseId: string,
): Promise<NotabilityBasisResyncResult> {
  if (plan.refusesToWrite) {
    throw new Error(
      [
        'Refusing to write a notability-basis resync:',
        ...formatNotabilityBasisResyncPlan(plan),
      ].join('\n'),
    );
  }
  let projectionRows = 0;
  let searchIndexRows = 0;
  for (const change of plan.changes) {
    const basis = JSON.stringify(change.basisAfter);
    const labels = JSON.stringify(change.labelsAfter);
    const result = await client.query(PROJECTION_AND_TAXONOMY_SQL, [
      basis,
      labels,
      releaseId,
      change.entityId,
    ]);
    projectionRows += result.rowCount ?? 1;
    if (change.writeTargets.includes('search_index.facets')) {
      const indexed = await client.query(SEARCH_INDEX_SQL, [
        basis,
        labels,
        releaseId,
        change.entityId,
      ]);
      searchIndexRows += indexed.rowCount ?? 1;
    }
  }
  return { projectionRows, searchIndexRows };
}

const LOAD_SQL = `
  SELECT re.entity_id,
         re.kind,
         re.display_name,
         re.summary,
         COALESCE(re.projection->'claims', '[]'::jsonb)           AS claims,
         COALESCE(re.projection->'notabilityBasis', '[]'::jsonb)  AS published_basis,
         COALESCE(re.projection->'notabilityLabels', '[]'::jsonb) AS published_labels,
         (re.taxonomy ? 'notabilityLabels')                       AS has_taxonomy_labels,
         (si.entity_id IS NOT NULL)                               AS has_search_index
    FROM bb_public.release_entities re
    LEFT JOIN bb_public.search_index si
      ON si.release_id = re.release_id AND si.entity_id = re.entity_id
   WHERE re.release_id = $1
     AND ($2::text[] IS NULL OR re.entity_id = ANY($2::text[]))
   ORDER BY re.entity_id
`;

type RawRow = {
  readonly entity_id: string;
  readonly kind: string | null;
  readonly display_name: string | null;
  readonly summary: string | null;
  readonly claims: unknown;
  readonly published_basis: unknown;
  readonly published_labels: unknown;
  readonly has_taxonomy_labels: boolean | null;
  readonly has_search_index: boolean | null;
};

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The claim fields the basis builder reads, recovered from the published JSONB. A claim missing
 * `citationSource` normalizes to '' (uncited) rather than being dropped, so a recompute here
 * matches what the builder would produce from the same claim set.
 */
export function toClaimProjections(value: unknown): readonly ReleaseClaimProjection[] {
  return asArray(value).map((raw, index) => {
    const claim = (raw ?? {}) as Record<string, unknown>;
    const href = claim.citationHref;
    return {
      id: typeof claim.id === 'string' ? claim.id : `claim_${index}`,
      predicate: typeof claim.predicate === 'string' ? claim.predicate : '',
      object: typeof claim.object === 'string' ? claim.object : '',
      confidenceLevel:
        claim.confidenceLevel === 'high' || claim.confidenceLevel === 'medium'
          ? claim.confidenceLevel
          : 'low',
      citationSource: typeof claim.citationSource === 'string' ? claim.citationSource : '',
      ...(typeof href === 'string' && href.length > 0 ? { citationHref: href } : {}),
      citationLabel: typeof claim.citationLabel === 'string' ? claim.citationLabel : '',
    };
  });
}

/** Published basis records recovered from JSONB, keeping only the three fields the rule reads. */
export function toBasisRecords(value: unknown): readonly NotabilityBasisRecord[] {
  return asArray(value).map((raw) => {
    const record = (raw ?? {}) as Record<string, unknown>;
    return {
      criterion: record.criterion as NotabilityCriterion,
      note: typeof record.note === 'string' ? record.note : '',
      evidenceIds: asArray(record.evidenceIds).filter((id): id is string => typeof id === 'string'),
    };
  });
}

/** SELECT only. `ids` undefined means every row in the release. */
export async function loadNotabilityBasisResyncRows(
  client: NotabilityBasisResyncClient,
  releaseId: string,
  ids?: readonly string[],
): Promise<readonly NotabilityBasisResyncRow[]> {
  const { rows } = await client.query<RawRow>(LOAD_SQL, [
    releaseId,
    ids === undefined ? null : [...ids],
  ]);
  return rows.map((row) => ({
    entityId: row.entity_id,
    kind: row.kind ?? '',
    displayName: row.display_name ?? '',
    summary: row.summary ?? '',
    claims: toClaimProjections(row.claims),
    publishedBasis: toBasisRecords(row.published_basis),
    publishedLabels: asArray(row.published_labels).filter(
      (label): label is string => typeof label === 'string',
    ),
    hasTaxonomyLabels: row.has_taxonomy_labels === true,
    hasSearchIndex: row.has_search_index === true,
  }));
}

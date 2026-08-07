/**
 * repo-n7p6.6 item 2 — one entity-timeline builder, shared by every public surface.
 *
 * Lifted verbatim (behaviour-preserving) from `apps/web/src/data/entity-graph-seed.ts`, where it
 * was reachable only by the web app. `apps/api-public` hard-coded `timeline: []` because it had
 * no access to it, so the same record carried a timeline on the website and an empty one over the
 * API. The builder lives here now and both surfaces call it; the web module re-exports from this
 * one rather than keeping a second copy.
 *
 * The inputs are the only two structured, evidence-backed time sources a published record has:
 *   - `statusHistory` — time-scoped status records, each already carrying its own
 *     `datePrecision` and the claim ids it rests on.
 *   - `related[].timespan` — dated graph edges.
 *
 * Nothing is inferred beyond those. An entry with no `validFrom` is emitted with the literal
 * label "Undated" rather than a guessed date, and callers that cannot render an undated row drop
 * it (`isUndatedTimelineEntry`) instead of inventing one.
 */
import { isDatePrecision, type DatePrecision } from '../era.js';

/** Label used when a source record carries no `validFrom` at all. Never a fabricated date. */
export const UNDATED_LABEL = 'Undated';

export type GraphTimelineEntry = {
  readonly id: string;
  /** Display-ready label, exactly as the web timeline has always rendered it. */
  readonly time: string;
  /**
   * Machine-parseable ISO timestamp, present only when `time` is precise enough to serialize one
   * without inventing a month or day. Absent for year/decade/circa and undated entries.
   */
  readonly at?: string;
  readonly datePrecision: DatePrecision;
  readonly title: string;
  readonly body: string;
};

/** Structurally matches both the domain `PublicRelatedEntry` (`type: RelationshipType`) and the
 * public-projection related entry (`type: string`) — the builder only humanizes/reads `type`,
 * never re-validates it against the closed vocabulary, so it accepts the wider shape. */
export type TimelineRelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?:
    | { readonly validFrom?: string | undefined; readonly validTo?: string | null | undefined }
    | undefined;
};

/**
 * Structural superset of `StatusHistoryEntry<EntityStatusValue>` (../entity-status.ts), widened
 * on two axes for the same reason `TimelineRelatedEntry.type` is a bare string: the builder only
 * humanizes `status` for display and never re-validates it, so it accepts the public-projection
 * shape as readily as the closed `EntityStatusValue` union — and it tolerates explicit
 * `undefined` on the optional date fields, which the projection's Zod-inferred type carries and
 * the repo's `exactOptionalPropertyTypes` would otherwise reject.
 */
export type TimelineStatusRecord = {
  readonly status: string;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | null | undefined;
  readonly datePrecision: DatePrecision;
  readonly basisClaimIds: readonly string[];
};

export type TimelineSourceEntity = {
  readonly id: string;
  readonly displayName: string;
  readonly statusHistory?: readonly TimelineStatusRecord[];
  readonly related?: readonly TimelineRelatedEntry[];
};

export function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** `{from} <verb phrase> {to}` sentence templates for the relationship types the graph uses,
 * plus a generic fallback for any other `RelationshipType`. Mirrors the direction semantics
 * documented in `RELATIONSHIP_TYPE_SEMANTICS` (../relationship.ts). */
const RELATIONSHIP_SENTENCE_TEMPLATES: Readonly<
  Record<string, (from: string, to: string) => string>
> = {
  located_at: (from, to) => `${from} is located at ${to}.`,
  occurred_at: (from, to) => `${from} occurred at ${to}.`,
  commemorates: (from, to) => `${from} commemorates ${to}.`,
  member_of: (from, to) => `${from} is a member of ${to}.`,
  part_of: (from, to) => `${from} is part of ${to}.`,
  founded: (from, to) => `${from} founded ${to}.`,
};

/** Exported so related-entry lists can render the identical sentence the timeline uses — one
 * description of a graph edge, not two independently-drifting copies. */
export function relationshipSentence(
  entry: TimelineRelatedEntry,
  thisDisplayName: string,
  neighborDisplayName: string,
): string {
  const template =
    RELATIONSHIP_SENTENCE_TEMPLATES[entry.type] ??
    ((from: string, to: string) => `${from} ${humanizeToken(entry.type).toLowerCase()} ${to}.`);
  return entry.direction === 'outgoing'
    ? template(thisDisplayName, neighborDisplayName)
    : template(neighborDisplayName, thisDisplayName);
}

/**
 * How precise a bare date string is, read off its own shape. Graph edge timespans carry no
 * explicit precision field the way `statusHistory` records do, so "1975" must not be reported as
 * day-precision. Anything unrecognized degrades to `year`, the weakest claim that still sorts.
 */
export function inferDatePrecision(value: string): DatePrecision {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/u.test(trimmed)) return 'day';
  if (/^\d{4}-\d{2}$/u.test(trimmed)) return 'month';
  if (/^\d{3}0s$/u.test(trimmed)) return 'decade';
  return 'year';
}

/**
 * ISO timestamp for an entry, ONLY when the precision genuinely supports one. A year-precision
 * "1971" must not become "1971-01-01T00:00:00.000Z" — that is a fabricated month and day, and the
 * timeline contract states `at` is "absent for genuinely undated entries — never fabricated".
 */
function isoTimestampFor(value: string, precision: DatePrecision): string | undefined {
  if (precision !== 'day') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** True when the entry has no real date behind it. Surfaces that cannot render an undated row
 * filter with this rather than dropping rows by string-matching the label. */
export function isUndatedTimelineEntry(entry: GraphTimelineEntry): boolean {
  return entry.time.trim().toLowerCase() === UNDATED_LABEL.toLowerCase();
}

/**
 * Builds one entity's timeline from its status history and dated related-entry timespans, sorted
 * chronologically. `entitiesById` resolves neighbor display names for the relationship sentences;
 * an unresolved neighbor falls back to its id rather than being dropped.
 */
export function buildGraphTimeline(
  entity: TimelineSourceEntity,
  entitiesById: ReadonlyMap<string, { readonly displayName: string }>,
): readonly GraphTimelineEntry[] {
  const dated: { readonly sortKey: string; readonly entry: GraphTimelineEntry }[] = [];

  (entity.statusHistory ?? []).forEach((record, index) => {
    const basis =
      record.basisClaimIds.length > 0 ? record.basisClaimIds.join(', ') : 'none recorded';
    const time = record.validFrom ?? UNDATED_LABEL;
    // Trust the record's own precision when it is a known value; a malformed one degrades to the
    // shape-inferred precision rather than failing the whole timeline.
    const precision: DatePrecision = isDatePrecision(record.datePrecision)
      ? record.datePrecision
      : inferDatePrecision(time);
    const at = record.validFrom === undefined ? undefined : isoTimestampFor(time, precision);
    dated.push({
      sortKey: record.validFrom ?? '',
      entry: {
        id: `${entity.id}_status_${index}`,
        time,
        ...(at !== undefined ? { at } : {}),
        datePrecision: precision,
        title: `Status: ${humanizeToken(record.status)}`,
        body: record.validTo
          ? `In effect from ${record.validFrom ?? 'an undated point'} through ${record.validTo}. Basis: ${basis}.`
          : `In effect from ${record.validFrom ?? 'an undated point'}, ongoing as of this release. Basis: ${basis}.`,
      },
    });
  });

  for (const rel of entity.related ?? []) {
    if (!rel.timespan?.validFrom) continue;
    const neighborName = entitiesById.get(rel.id)?.displayName ?? rel.id;
    const sentence = relationshipSentence(rel, entity.displayName, neighborName);
    const precision = inferDatePrecision(rel.timespan.validFrom);
    const at = isoTimestampFor(rel.timespan.validFrom, precision);
    dated.push({
      sortKey: rel.timespan.validFrom,
      entry: {
        id: `${entity.id}_rel_${rel.id}_${rel.type}`,
        time: rel.timespan.validFrom,
        ...(at !== undefined ? { at } : {}),
        datePrecision: precision,
        title: humanizeToken(rel.type),
        body: rel.timespan.validTo
          ? `${sentence} Through ${rel.timespan.validTo}.`
          : `${sentence} Ongoing connection.`,
      },
    });
  }

  return dated
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.entry.id.localeCompare(b.entry.id))
    .map((item) => item.entry);
}

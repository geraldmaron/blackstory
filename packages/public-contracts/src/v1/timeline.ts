/**
 * Public timeline entry — extracted from `apps/web/src/data/entity-graph-seed.ts`'s
 * `GraphTimelineEntry` (`{id, time, title, body}`), extended with an explicit `datePrecision`
 * field per MOB-003's requirement that "dates include precision." `GraphTimelineEntry.time` is a
 * display-ready label (sometimes "Undated"), not a precision-tagged date, so this contract adds
 * `datePrecision` (the same `DatePrecision` vocabulary already carried by
 * `PublicEventWindow.datePrecision` in `apps/web/src/data/public-seed.ts`) and keeps the original
 * label as `atLabel` for backward-compatible display, plus an optional machine-parseable `at` ISO
 * timestamp when the underlying date is known precisely enough to serialize one.
 */
import { z } from 'zod';
import { idString, isoTimestamp, nonEmptyText } from '../internal/primitives.js';
import { datePrecisionSchema } from '../internal/primitives.js';

export const timelineEventV1Schema = z
  .object({
    id: idString(200),
    /** Human-facing date label as already shown in the web timeline (may be "Undated"). */
    atLabel: nonEmptyText(120),
    /** Machine-parseable ISO timestamp, when known. Absent for genuinely undated entries — never
     * fabricated. */
    at: isoTimestamp().optional(),
    datePrecision: datePrecisionSchema,
    title: nonEmptyText(300),
    body: nonEmptyText(4000),
  });

export type TimelineEventV1 = z.infer<typeof timelineEventV1Schema>;

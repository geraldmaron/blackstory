/**
 * Per-source update-cadence metadata for the historic-safety engine, shaped to be directly
 * compatible with `JobCadence` (`packages/config/src/scheduled-jobs/types.ts`) without
 * this package depending on `@repo/config` (the dependency direction runs the other way:
 * config depends on domain, not vice versa \u2014 see that package's own `package.json`). Any
 * job body (stub or real) can spread one of these cadence records directly into a
 * `ScheduledJobDefinition.cadence` field.
 *
 * `packages/config/src/scheduled-jobs/roster.ts` already carries two -owned stub roster
 * entries with cadences matching this module's `fbiHateCrime` (annual) and
 * `tougalooMappingInequality` (quarterly) entries \u2014 this module is the domain-owned source of
 * truth those roster entries' cadence numbers were drawn from; it does not re-declare or import
 * the roster itself (this package cannot depend on `@repo/config`).
 */

/** Structurally identical to `JobCadence` shape (duplicated, not imported, to keep this
 * package's dependency direction intact). */
export type HistoricSafetySourceCadence = {
  readonly cronExpression: string;
  readonly nominalIntervalMs: number;
  readonly humanReadable: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const QUARTER_MS = 91 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export const HISTORIC_SAFETY_SOURCE_CADENCE_IDS = [
  'fbi-hate-crime',
  'fbi-general-crime-context',
  'tougaloo-mapping-inequality',
  'eji-lynching-records',
  'own-corpus-layers',
] as const;

export type HistoricSafetySourceCadenceId = (typeof HISTORIC_SAFETY_SOURCE_CADENCE_IDS)[number];

/**
 * Published per-source cadences (design note: "FBI data annually on release;
 * Tougaloo/Mapping Inequality checked for dataset revisions; our own corpus layers recompute on
 * release activation"). `own-corpus-layers` uses the same event-driven sentinel convention
 * defines for release-coupled work (`EVENT_DRIVEN_CADENCE_SENTINEL`, duplicated here as a literal
 * string for the same dependency-direction reason as the type above) with an hourly safety-net
 * poll, mirroring `release-coupled-rebuild`'s own roster entry.
 */
export const HISTORIC_SAFETY_SOURCE_CADENCES: Readonly<Record<HistoricSafetySourceCadenceId, HistoricSafetySourceCadence>> = {
  'fbi-hate-crime': {
    cronExpression: '0 6 1 10 *',
    nominalIntervalMs: YEAR_MS,
    humanReadable: 'annually, Oct 1 06:00 UTC (matches FBI hate-crime annual release)',
  },
  'fbi-general-crime-context': {
    cronExpression: '0 6 1 10 *',
    nominalIntervalMs: YEAR_MS,
    humanReadable: 'annually, Oct 1 06:00 UTC (same FBI CDE/NIBRS release window; context only)',
  },
  'tougaloo-mapping-inequality': {
    cronExpression: '0 6 1 */3 *',
    nominalIntervalMs: QUARTER_MS,
    humanReadable: 'quarterly, 1st 06:00 UTC (checked for dataset revisions)',
  },
  'eji-lynching-records': {
    cronExpression: '0 6 1 */3 *',
    nominalIntervalMs: QUARTER_MS,
    humanReadable: 'quarterly, 1st 06:00 UTC (checked for dataset revisions, same cadence as Tougaloo/Mapping Inequality)',
  },
  'own-corpus-layers': {
    cronExpression: 'event-driven',
    nominalIntervalMs: HOUR_MS,
    humanReadable: 'on release activation (event-driven); hourly safety-net poll',
  },
};

/**
 * "Every layer displays an as-of date": a layer's displayed `asOf` should never be staler
 * than its source's nominal cadence would suggest without flagging it. Returns true when `asOf`
 * is older than `nominalIntervalMs` relative to `now` \u2014 a presentation hint, not a fail-closed
 * gate (a stale-but-still-accurate historical layer is never hidden; it is a "history does not
 * expire" layer, per ../documented-events.ts's own module doc).
 */
export function isLayerAsOfOverdueForCadence(input: {
  readonly asOf: string;
  readonly cadenceId: HistoricSafetySourceCadenceId;
  readonly now: string;
}): boolean {
  const asOfMs = Date.parse(input.asOf);
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(nowMs)) {
    throw new Error('isLayerAsOfOverdueForCadence requires valid ISO dates for asOf and now');
  }
  const cadence = HISTORIC_SAFETY_SOURCE_CADENCES[input.cadenceId];
  return nowMs - asOfMs > cadence.nominalIntervalMs;
}

/**
 * Pure, synchronously-testable view-model logic for the entity detail page. The page
 * itself is an async Server Component reading a `Promise<params>` (not renderable via
 * `renderToStaticMarkup` outside a real Next.js request); this module extracts the
 * status-driven decision logic the page's JSX consumes so it stays directly testable.
 */
import type { PublicEntityView } from '../../../data/public-seed';

export type HistoricalFraming = 'historical' | 'present_day';

/**
 * Historical-vs-present-day framing is DERIVED from the status-lifecycle field, never authored
 * as prose. `event` kinds carry no status field at all (their when-span is authoritative) and
 * always frame as historical — a documented past happening is never "present-day". Every other
 * kind frames as present-day only when its derived current status is `active`; `historic`/
 * `inactive` (or a missing status) frame as historical.
 */
export function deriveHistoricalFraming(entity: PublicEntityView): HistoricalFraming {
  if (entity.kind === 'event') return 'historical';
  return entity.status === 'active' ? 'present_day' : 'historical';
}

/** True when a record has no claims, no related entries, and no timeline the case that must
 * render approved missing-information language rather than an
 * empty section with no explanation. */
export function isSparseRecord(entity: PublicEntityView): boolean {
  return (
    entity.claims.length === 0 &&
    (entity.related ?? []).length === 0 &&
    entity.timeline.length === 0
  );
}

/**
 * True when the record has not been researched beyond its source listing. The page owes the
 * reader that fact outright, because a short record with no caveat reads as "this is the whole of
 * the recorded history" when it actually means "the research has not happened yet". Derived from
 * published fields, never inferred from how empty the page looks.
 *
 * Two conditions, both required, because `researchCoverage` alone answers a narrower question
 * than THIN_RECORD_COPY asserts. Coverage counts distinct source DOCUMENTS (repo-z1pw), so
 * 'minimal' means "one document stands behind this", which covers two different records:
 *
 *  - a registry row nobody has researched (no historicalContext) — the notice is exactly true;
 *  - a genuinely researched record that leans on a single source (Crispus Attucks: five claims
 *    and a 444-char historicalContext, all from one Wikipedia page). Printing "what you see here
 *    is the listing itself rather than a researched history" over real narrative prose would be
 *    a false statement in the other direction, which is the same failure this notice exists to
 *    prevent.
 *
 * So the notice requires the absence of narrative context too. Single-sourced-but-researched
 * records need a corroboration disclosure instead — a different sentence, deliberately not
 * invented here (repo-ol8v).
 */
export function isThinRecord(entity: PublicEntityView): boolean {
  if (entity.researchCoverage !== 'minimal') return false;
  return (entity.historicalContext ?? '').trim().length === 0;
}

/**
 * Pure, synchronously-testable view-model logic for the entity detail page (BB-052). The page
 * itself is an async Server Component reading a `Promise<params>` (not renderable via
 * `renderToStaticMarkup` outside a real Next.js request — see
 * `apps/web/src/app/search/search-view-model.test.ts`'s own note on this same constraint); this
 * module extracts the BB-090-driven decision logic the page's JSX consumes so it stays directly
 * testable.
 */
import type { PublicEntityView } from '../../../data/public-seed';

export type HistoricalFraming = 'historical' | 'present_day';

/**
 * BB-052 acceptance criterion 3/5: historical-vs-present-day framing is DERIVED from the BB-090
 * status-lifecycle field, never authored as prose. `event` kinds carry no status field at all
 * (their when-span is authoritative) and always frame as historical — a documented past happening
 * is never "present-day". Every other kind frames as present-day only when its derived current
 * status is `active`; `historic`/`inactive` (or a missing status) frame as historical.
 */
export function deriveHistoricalFraming(entity: PublicEntityView): HistoricalFraming {
  if (entity.kind === 'event') return 'historical';
  return entity.status === 'active' ? 'present_day' : 'historical';
}

/** True when a record has no claims, no related entries, and no timeline — the case that must
 * render approved missing-information language (BB-052 acceptance criterion 2) rather than an
 * empty section with no explanation. */
export function isSparseRecord(entity: PublicEntityView): boolean {
  return entity.claims.length === 0 && (entity.related ?? []).length === 0 && entity.timeline.length === 0;
}

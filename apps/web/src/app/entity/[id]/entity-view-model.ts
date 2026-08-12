/**
 * Pure, synchronously-testable view-model logic for the entity detail page. The page
 * itself is an async Server Component reading a `Promise<params>` (not renderable via
 * `renderToStaticMarkup` outside a real Next.js request); this module extracts the
 * status-driven decision logic the page's JSX consumes so it stays directly testable.
 */
import type { PublicEntityView } from '../../../data/public-seed';
import { humanizeToken } from '../../../components/entity/format';

/**
 * Present standing of the SUBJECT, for the mast's glance line.
 *
 * Standing and era are different axes and must not be phrased as if they compete. A church
 * built in the 1890s that still holds services spans the 1890s AND is active; the mast used to
 * answer this slot with "Present-day record", which reads as a claim about *when* the record
 * belongs and sat directly beside the era saying something else.
 *
 * It was also wrong for two whole vocabularies. The old rule was `status === 'active'`, but only
 * place-like kinds ever take that value: laws are `in_force`, people are `living`. Measured on
 * the active release, that mislabelled 66 in-force laws and cases as "Historical record", and no
 * living person could ever have come out as present-day.
 *
 * So this returns the record's own status vocabulary (the same terms `StatusMark` renders) and
 * nothing else. `undefined` means the slot is dropped rather than filled with a default:
 * `event` kinds are statusless by design — their when-span is authoritative — and `unknown` is
 * a real answer that must not harden into "Historical record" for the 112 people carrying it.
 */
export function deriveRecordStanding(entity: PublicEntityView): string | undefined {
  if (entity.kind === 'event') return undefined;
  const status = entity.status?.trim();
  if (!status || status === 'unknown') return undefined;
  return humanizeToken(status);
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

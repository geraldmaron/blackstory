/**
 * The 404 gate for record rooms (`/place/{slug}`, `/invention/{slug}`).
 *
 * A layout decides existence before the page renders, so a missing record answers a real 404 and
 * never a "200 Place not found". Record routes have no segment `loading.tsx` (a record must read
 * without script; see `public-route-loading.test.tsx`), so the page's own `notFound()` would now
 * give the same status; the gate keeps the lookup in one place for both families.
 *
 * Each family passes the lookup its own page uses (`loadPlaceRecord`, `loadInventionRecord`), so
 * the gate and the page ask the same question. A store that cannot be reached already resolves
 * to no record and renders the not-found room; the gate only gives that the status it claims.
 */
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

export type ReleasedRecordGateProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly slug: string }>;
};

/** A layout that answers 404 when `load` finds no released record at the slug. */
export function releasedRecordGate(load: (slug: string) => Promise<unknown>) {
  return async function ReleasedRecordGate({ children, params }: ReleasedRecordGateProps) {
    const { slug } = await params;
    if ((await load(slug)) === undefined) notFound();
    return children;
  };
}

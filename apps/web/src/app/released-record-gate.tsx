/**
 * The 404 gate for record rooms (`/place/{slug}`, `/invention/{slug}`).
 *
 * Both rooms stream behind a segment `loading.tsx`. Once that skeleton flushes, the response has
 * already committed to 200, so the page body's own `notFound()` can only add `noindex`: a missing
 * record answered "200 Place not found", a soft 404 to every crawler and link checker. A layout
 * renders outside its own segment's loading boundary, so deciding existence here, before the
 * skeleton, is what lets a missing record answer a real 404 while a real one still streams.
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

/**
 * The 404 gate for record rooms (`/place/{slug}`, `/invention/{slug}`).
 *
 * Both rooms stream behind a segment `loading.tsx`. Once that skeleton flushes, the response has
 * already committed to 200, so the page body's own `notFound()` can only add `noindex`: a missing
 * record answered "200 Place not found", a soft 404 to every crawler and link checker. A layout
 * renders outside its own segment's loading boundary, so deciding existence here, before the
 * skeleton, is what lets a missing record answer a real 404 while a real one still streams.
 *
 * The lookup is the same one the room does (`loadHomeFirstPaint` with `requireNamed`), memoized per
 * request so the gate adds no read of its own. A store that cannot be reached already resolves to
 * no lead and renders the not-found room; the gate only gives that the status it already claims.
 */
import type { ReactNode } from 'react';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { isResolvablePlaceSlug } from '../lib/place/place-slug';
import { loadHomeFirstPaint } from './home-first-paint';

/** Whether a released record answers at this slug. One lookup per request. */
export const releasedRecordExists = cache(async (slug: string): Promise<boolean> => {
  if (!isResolvablePlaceSlug(slug)) return false;
  const model = await loadHomeFirstPaint({ namedSlug: slug, requireNamed: true });
  return model.lead !== undefined;
});

export type ReleasedRecordGateProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly slug: string }>;
};

export async function ReleasedRecordGate({ children, params }: ReleasedRecordGateProps) {
  const { slug } = await params;
  if (!(await releasedRecordExists(slug))) notFound();
  return children;
}

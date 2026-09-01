/**
 * `/` is the door: existing about framing above the existing HTML pin plate.
 * People need to know what they are walking into, then walk into a place.
 * The Atlas instrument stays on `/explore`. This page does not mount it.
 */
import type { Metadata } from 'next';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { DoorHome } from './door-home';

/**
 * ISR: the pin plate is release-wide (same bytes for every reader until the catalog changes).
 * `loadDoorEntities` falls back to seed when Postgres is absent at build time. Chapter rolls stay
 * per regeneration window, not per bot hit. Keep page-scoped; do not hoist to the root layout.
 */
export const revalidate = 300;

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage() {
  return <DoorHome />;
}

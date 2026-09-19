/**
 * `/` is the door: cinematic journey over the shared map plate. Browse morphs in place;
 * `/explore` remains the deep-link / share URL for the armed posture.
 */
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { absolutePublicUrl } from '../lib/seo/metadata-builders';
import { ABOUT_LINE } from './about/about-copy';
import { DoorHome } from './door-home';

/**
 * No `title`: the root layout's default is the product name.
 * Canonical stays the bare `/` (SP-19).
 */
export const metadata: Metadata = {
  description: ABOUT_LINE,
  alternates: { canonical: absolutePublicUrl('/') },
};

export default async function HomePage() {
  // The live catalog is runtime data. Its loaders cache release data across requests.
  await connection();
  return <DoorHome />;
}

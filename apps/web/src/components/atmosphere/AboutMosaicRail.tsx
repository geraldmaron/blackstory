/**
 * About-page mosaic rail — fills the desktop open gutter beside longform copy
 * with a living archive collage. Decorative; credits link is the accessible
 * attribution surface.
 */
'use client';

import Link from 'next/link';
import { ATMOSPHERE_ATTRIBUTION_HREF } from './tile-credits';
import { LivingAtmosphereMosaic } from './LivingAtmosphereMosaic';
import './atmosphere.css';

export function AboutMosaicRail() {
  return (
    <aside className="ds-about__mosaic-rail">
      <LivingAtmosphereMosaic seedKey="about" density={16} columns={4} />
      <p className="ds-about__mosaic-credit">
        Archive mosaic · symbolic atmosphere.{' '}
        <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
      </p>
    </aside>
  );
}

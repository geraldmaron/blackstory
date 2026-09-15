/**
 * `/lives`: Lives Across the Decades, the index of modeled regions.
 *
 * Not indexed and not linked from navigation until IPUMS confirms public-web use of the
 * tabulations (bead repo-0clax.2). Method: docs/methodology/lives-across-decades.md.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { LIVES_REGIONS } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader } from '../../components/room';
import '../reading-room.css';
import './lives.css';

const DESCRIPTION =
  'How Black, white and Hispanic residents of the same place were spread across class, decade by decade from the 1870s, what their lives measured, and which laws were in force.';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/lives',
  title: 'Lives across the decades',
  description: DESCRIPTION,
  noIndex: true,
});

export default function LivesIndexPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/lives"
        kicker="Lives across the decades"
        title="Lives across the decades"
        lede="The same place in the same decade was lived very differently depending on race. Pick a region to see how Black, white and Hispanic residents were spread across class, what their lives measured, and which laws were in force, from the 1870s to today."
        meta={['1870s to 2020s', 'Census records', 'Laws from the catalog']}
      />
      <ul className="lives-regions">
        {LIVES_REGIONS.map((region) => (
          <li key={region.id} className="lives-regions__item">
            <Link className="lives-regions__name" href={`/lives/${region.slug}`}>
              {region.name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="lives-method">
        Every figure is counted from census records, shows how many records stand behind it, and
        says when there are too few to count. Laws are shown beside the figures, not as their cause.
      </p>
    </Room>
  );
}

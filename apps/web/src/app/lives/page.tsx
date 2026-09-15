/**
 * `/lives`: Lives Across the Decades, the national baseline and the six regions.
 *
 * Not indexed and not linked from navigation until the public method page and the verification pass
 * are done (beads repo-0clax.17, repo-0clax.14). Method: docs/methodology/lives-across-decades.md.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { LIVES_AREAS } from '@repo/domain/statistics/lives';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Room, RoomHeader } from '../../components/room';
import '../reading-room.css';
import './lives.css';

const DESCRIPTION =
  'How Black, white and Hispanic Americans were spread across class, decade by decade from the 1870s, what their lives measured, which laws were in force, and what the census could and could not see.';

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
        lede="The same decade was lived very differently depending on race and region. Start with the whole country or pick a region to see how Black, white and Hispanic Americans were spread across class, what their lives measured, and which laws were in force, from the 1870s to today."
        meta={['1870s to 2020s', 'Published census tables', 'Laws from the catalog']}
      />
      <ul className="lives-regions">
        {LIVES_AREAS.map((area) => (
          <li key={area.id} className="lives-regions__item">
            <Link className="lives-regions__name" href={`/lives/${area.slug}`}>
              {area.name}
            </Link>
            <p className="lives-regions__summary">{area.summary}</p>
          </li>
        ))}
      </ul>
      <p className="lives-method">
        Every figure comes from a table the census published, and names the definition it used.
        Where the census did not count a group, or counted too few, the page says so and explains
        why. Laws are shown beside the figures, not as their cause.
      </p>
    </Room>
  );
}

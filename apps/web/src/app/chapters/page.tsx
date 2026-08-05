/**
 * Chapters index at `/chapters`: the single long-form publication surface that
 * replaces the old /themes + /stories + /topics + /articles split. Thin list
 * items load from the active-release article projection; full bodies load on
 * detail pages.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { listPublicArticleListItems } from '../../lib/articles/source';
import { CardGrid, Note, OffRamp, Room, RoomCard, RoomHeader } from '../../components/room';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/chapters',
  title: 'Chapters',
  description:
    'Evidence-led long-form chapters from the BlackStory archive: history pinned to place and records, with every figure and claim cited inline.',
});

export default async function ChaptersIndexPage() {
  const { items, source } = await listPublicArticleListItems();

  return (
    <Room>
      <RoomHeader
        pathname="/chapters"
        kicker="Chapters"
        title="History pinned to place and record."
        lede="Long-form pieces that walk from a named year and place through the rules in force and the measured odds under them. Every figure and quotation cites the record it rests on."
      />

      {source === 'unavailable' ? (
        <Note kind="Unavailable">
          Chapters are temporarily unavailable while we reconnect to the live record. Nothing here
          is lost; please check back shortly.
        </Note>
      ) : items.length === 0 ? (
        <Note kind="Empty">No chapters are published yet.</Note>
      ) : (
        <CardGrid>
          {items.map((item) => (
            <RoomCard
              key={item.slug}
              href={`/chapters/${item.slug}`}
              kind="Chapter"
              title={item.title}
              description={item.summary}
              meta={`${item.eraLabel} · ${item.placeLabel}`}
              {...(item.heroImage ? { media: item.heroImage } : {})}
            />
          ))}
        </CardGrid>
      )}

      <OffRamp
        title="Go straight to the archive"
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Search the archive', href: '/records' },
        ]}
      >
        Every figure and quotation in these chapters cites its record.
      </OffRamp>
    </Room>
  );
}

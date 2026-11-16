/**
 * The one block at the end of a story, after its sources: a copper band across the sheet's foot
 * with where to read next (a ruled index of names), then the records the story links to. An entry in a collection offers the next entry with the previous one beside
 * it on one row; a chapter, or an entry at the end of its collection, offers the other chapters.
 */
import React from 'react';
import type { ReactNode } from 'react';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import { StoryImage } from './StoryImage';
import { storyImageSrc } from './story-image';

void React;

const href = (item: PublicStoryListItemDoc) => `/stories/${item.slug}`;

/** One row of the index: direction, name, term and one line, with the portrait as a small plate. */
function IndexRow({
  item,
  direction,
}: {
  readonly item: PublicStoryListItemDoc;
  readonly direction: ReactNode;
}) {
  const image = item.heroImage;
  return (
    <a className="ds-story-next__item" href={href(item)}>
      <span className="ds-story-next__text">
        <span className="ds-story-next__meta">{direction}</span>
        <span className="ds-story-next__title">{item.title}</span>
        <span className="ds-story-next__term">{item.eraLabel}</span>
        <span className="ds-story-next__summary">{item.summary}</span>
      </span>
      {image ? (
        <span className="ds-plate ds-plate--upper ds-story-next__plate">
          <span className="ds-plate__tone">
            <StoryImage
              className="ds-plate__img"
              src={storyImageSrc(image.url, 120, image.width)}
              fallbackSrc={image.url}
              alt=""
              inLink
            />
          </span>
        </span>
      ) : null}
    </a>
  );
}

const previousDirection = (previous: PublicStoryListItemDoc) => (
  <>
    <span aria-hidden="true">← </span>
    {['Previous', previous.collection?.positionLabel].filter(Boolean).join(' · ')}
  </>
);

function NextInCollection({
  next,
  previous,
  collectionLabel,
  position,
}: {
  readonly next: PublicStoryListItemDoc;
  readonly previous?: PublicStoryListItemDoc | undefined;
  readonly collectionLabel: string;
  /** "3 of 45": where the next entry sits in its collection. */
  readonly position: string;
}) {
  return (
    <div className="ds-story-next">
      <div className="ds-story-end__headrow">
        <h2 className="ds-section-heading ds-story-end__heading">Next in {collectionLabel}</h2>
        <span className="ds-story-end__count">{position}</span>
      </div>
      <div className="ds-story-next__row">
        <IndexRow
          item={next}
          direction={['Next', next.collection?.positionLabel].filter(Boolean).join(' · ')}
        />
        {previous ? <IndexRow item={previous} direction={previousDirection(previous)} /> : null}
      </div>
    </div>
  );
}

function ChapterCards({ chapters }: { readonly chapters: readonly PublicStoryListItemDoc[] }) {
  return (
    <div className="ds-story-chapters">
      <h2 className="ds-section-heading ds-story-end__heading">More chapters</h2>
      <ul className="ds-story-chapters__list">
        {chapters.map((chapter) => (
          <li key={chapter.slug}>
            <a className="ds-story-chapters__card" href={href(chapter)}>
              <span className="ds-story-chapters__media">
                {chapter.heroImage ? (
                  <StoryImage
                    src={storyImageSrc(chapter.heroImage.url, 460, chapter.heroImage.width)}
                    fallbackSrc={chapter.heroImage.url}
                    alt=""
                    inLink
                  />
                ) : null}
              </span>
              <span className="ds-story-chapters__title">{chapter.title}</span>
              <span className="ds-story-chapters__years">{chapter.eraLabel}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type StoryEndProps = {
  readonly next?: PublicStoryListItemDoc | undefined;
  readonly previous?: PublicStoryListItemDoc | undefined;
  readonly collectionLabel?: string | undefined;
  /** "3 of 45" for the next entry. */
  readonly nextPosition?: string | undefined;
  /** Other chapters, used when there is no next entry. */
  readonly chapters: readonly PublicStoryListItemDoc[];
  /** The records block (StoryRecords), or nothing. */
  readonly records?: ReactNode;
};

export function StoryEnd({
  next,
  previous,
  collectionLabel,
  nextPosition,
  chapters,
  records,
}: StoryEndProps) {
  const onward =
    next && collectionLabel && nextPosition ? (
      <NextInCollection
        next={next}
        previous={previous}
        collectionLabel={collectionLabel}
        position={nextPosition}
      />
    ) : chapters.length > 0 ? (
      <ChapterCards chapters={chapters} />
    ) : null;
  return (
    <section
      className="ds-story-wide ds-story-end"
      aria-label="After this story"
      data-ground="copper"
    >
      {onward}
      {/* The last entry of a collection has no next card; its previous entry still gets a way back. */}
      {previous && !(next && collectionLabel && nextPosition) ? (
        <div className="ds-story-next__row">
          <IndexRow item={previous} direction={previousDirection(previous)} />
        </div>
      ) : null}
      {records}
    </section>
  );
}

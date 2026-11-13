/**
 * The one block at the end of a story, before its sources: where to read next, then the records
 * the story links to. An entry in a collection offers the next entry with the previous one beside
 * it on one row; a chapter, or an entry at the end of its collection, offers the other chapters.
 */
import React from 'react';
import type { ReactNode } from 'react';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import { StoryImage } from './StoryImage';
import { storyImageSrc } from './story-image';

void React;

const href = (item: PublicStoryListItemDoc) => `/stories/${item.slug}`;

/** The previous entry: the same card at a quieter weight, no picture or summary. */
function PreviousCard({ previous }: { readonly previous: PublicStoryListItemDoc }) {
  return (
    <a className="ds-story-next__card ds-story-next__card--previous" href={href(previous)}>
      <span className="ds-story-next__text">
        <span className="ds-story-next__meta">
          <span aria-hidden="true">← </span>
          {['Previous', previous.collection?.positionLabel].filter(Boolean).join(' · ')}
        </span>
        <span className="ds-story-next__title">{previous.title}</span>
      </span>
    </a>
  );
}

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
  const image = next.heroImage;
  return (
    <div className="ds-story-next">
      <div className="ds-story-end__headrow">
        <h2 className="ds-section-heading ds-story-end__heading">Next in {collectionLabel}</h2>
        <span className="ds-story-end__count">{position}</span>
      </div>
      <div className="ds-story-next__row">
        {previous ? <PreviousCard previous={previous} /> : null}
        <a className="ds-story-next__card" href={href(next)}>
          {image ? (
            <span className="ds-story-next__thumb">
              <StoryImage
                src={storyImageSrc(image.url, 120, image.width)}
                fallbackSrc={image.url}
                alt=""
                inLink
              />
            </span>
          ) : null}
          <span className="ds-story-next__text">
            <span className="ds-story-next__meta">
              {[next.collection?.positionLabel, next.eraLabel].filter(Boolean).join(' · ')}
            </span>
            <span className="ds-story-next__title">{next.title}</span>
            <span className="ds-story-next__summary">{next.summary}</span>
          </span>
        </a>
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
    <section className="ds-story-wide ds-story-end" aria-label="After this story">
      {onward}
      {/* The last entry of a collection has no next card; its previous entry still gets a way back. */}
      {previous && !(next && collectionLabel && nextPosition) ? (
        <div className="ds-story-next__row">
          <PreviousCard previous={previous} />
        </div>
      ) : null}
      {records}
    </section>
  );
}

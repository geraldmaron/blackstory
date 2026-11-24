/**
 * The pieces of the `/stories` front: a chapter entry (its cover as a compact exhibit when the
 * cover is safe on a front page, a text entry when it is not), a list row and the one toolbar.
 * Server components; the only client code is StoryImage's load and error state.
 *
 * Everything is on paper. A cover is shown whole and in its own color, with its credit under it.
 */
import React from 'react';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import { ExhibitFrame, FilterButton, Receipt, buttonClassName } from '@repo/ui';
import { StoryImage } from '../../components/story/StoryImage';
import { storyImageSrc } from '../../components/story/story-image';
import { coverDek } from '../../components/story/story-text';
import { frontSafeCover } from '../../lib/stories/cover-safety';

void React;

import { storyHref as href } from '../../lib/stories/story-routes';

function readLabel(item: PublicStoryListItemDoc): string {
  return item.format === 'entry' ? 'Read the entry' : 'Read the chapter';
}

export function CoverImage({
  item,
  width,
  eager = false,
  className = 'ds-stories-cover__img',
}: {
  readonly item: PublicStoryListItemDoc;
  readonly width: number;
  readonly eager?: boolean;
  /** The image's own class, where a caller lays the cover out differently. */
  readonly className?: string;
}) {
  // Hidden unless the story is listed as safe; home and the old Explore front read this too.
  const image = frontSafeCover(item);
  if (!image) return <span className="ds-stories-cover__blank" aria-hidden="true" />;
  return (
    <StoryImage
      className={className}
      src={storyImageSrc(image.url, width, image.width)}
      fallbackSrc={image.url}
      alt=""
      eager={eager}
      inLink
    />
  );
}

/**
 * One chapter on the front: years, the title in display type, one line, the way in. Its cover
 * stands beside it as a compact exhibit (crop marks, credit, no kind label) only when
 * `frontSafeCover` allows it; otherwise the entry is text. `lead` sets the newest chapter larger.
 */
export function ChapterCover({
  item,
  lead = false,
}: {
  readonly item: PublicStoryListItemDoc;
  readonly lead?: boolean;
}) {
  const cover = frontSafeCover(item);
  return (
    <article
      className="ds-stories-cover"
      data-lead={lead ? '' : undefined}
      data-media={cover ? 'photo' : 'none'}
    >
      {cover ? (
        <ExhibitFrame
          className="ds-stories-cover__media"
          id={`cover-${item.slug}`}
          kind="photograph"
          variant="compact"
          receipt={<Receipt source={cover.credit} />}
        >
          <CoverImage item={item} width={lead ? 720 : 460} eager={lead} />
        </ExhibitFrame>
      ) : null}
      <div className="ds-stories-cover__caption">
        <p className="ds-stories-cover__years">{item.eraLabel}</p>
        <h2 className="ds-stories-cover__title">
          <a className="ds-stories-cover__link" href={href(item)}>
            {item.title}
          </a>
        </h2>
        <p className="ds-stories-cover__dek">{coverDek(item.summary)}</p>
        {lead ? (
          <a className={buttonClassName('primary', 'ds-stories-cover__cta')} href={href(item)}>
            {readLabel(item)}
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** A list row: a small portrait where the cover is safe to show, the name, the years in mono,
 *  one line of summary. A row with no portrait is a text row. */
export function StoryRow({ item }: { readonly item: PublicStoryListItemDoc }) {
  const image = frontSafeCover(item);
  // An entry names its place in its collection ("2nd president"); a chapter says it is one.
  const kind = item.collection?.positionLabel ?? (item.format === 'entry' ? 'Entry' : 'Chapter');
  return (
    <li className="ds-stories-row">
      <a className="ds-stories-row__link" href={href(item)} data-media={image ? 'photo' : 'none'}>
        {image ? (
          <span className="ds-stories-row__thumb">
            <StoryImage
              src={storyImageSrc(image.url, 72, image.width)}
              fallbackSrc={image.url}
              alt=""
              inLink
            />
          </span>
        ) : null}
        <span className="ds-stories-row__title">{item.title}</span>
        <span className="ds-stories-row__years">{item.eraLabel}</span>
        <span className="ds-stories-row__kind">{kind}</span>
        <span className="ds-stories-row__summary">{item.summary}</span>
      </a>
    </li>
  );
}

export type SortOption = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
};

const SORT_MENU_ID = 'stories-sort';

function SortGlyph() {
  return (
    <svg className="ds-stories-toolbar__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 3v10m0 0-2.5-2.5M5 13l2.5-2.5M11 13V3m0 0L8.5 5.5M11 3l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg className="ds-stories-sort__check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The one toolbar: Sort. Every option is a link (the state is the URL), and the menu is a native
 * popover, so the page narrows with JavaScript off. The editorial format is not a reader's filter.
 */
export function StoriesToolbar({ sort }: { readonly sort: readonly SortOption[] }) {
  const current = sort.find((option) => option.current) ?? sort[0];
  return (
    <div className="ds-stories-toolbar">
      <div className="ds-stories-toolbar__controls">
        <FilterButton
          className="ds-stories-toolbar__sort"
          popoverTarget={SORT_MENU_ID}
          aria-label={`Sort: ${current?.label ?? ''}`}
        >
          <SortGlyph />
          {current?.label}
        </FilterButton>
        <div
          className="ds-stories-sort"
          id={SORT_MENU_ID}
          popover="auto"
          role="dialog"
          aria-labelledby={`${SORT_MENU_ID}-title`}
        >
          <h2 className="ds-stories-sort__title" id={`${SORT_MENU_ID}-title`}>
            Sort
          </h2>
          <ul className="ds-stories-sort__list">
            {sort.map((option) => (
              <li key={option.key}>
                <a
                  className="ds-stories-sort__option"
                  href={option.href}
                  aria-current={option.current ? 'true' : undefined}
                >
                  {option.current ? <CheckGlyph /> : <span className="ds-stories-sort__check" />}
                  {option.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

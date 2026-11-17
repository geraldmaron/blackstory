/**
 * The pieces of the `/stories` front: the lead cover, the chapter covers, a list row and the one
 * toolbar. Server components; the only client code is StoryImage's load and error state.
 *
 * Material: the lead runs edge to edge with an ink panel, the other chapters are ruled rows with
 * a toned plate, and the list is one paper sheet on the ink table.
 */
import React from 'react';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import { FilterButton, Segmented, buttonClassName } from '@repo/ui';
import { StoryImage } from '../../components/story/StoryImage';
import { storyImageSrc } from '../../components/story/story-image';
import { coverDek } from '../../components/story/story-text';

void React;

const href = (item: PublicStoryListItemDoc) => `/stories/${item.slug}`;

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
  /** `ds-plate__img` when the cover stands as a toned plate (home's lead story). */
  readonly className?: string;
}) {
  const image = item.heroImage;
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
 * The newest chapter, edge to edge under the header: the cover unfiltered, and the title at display
 * scale on a solid panel that overlaps the picture's foot. The panel is the table's ground (ink in
 * the dark theme, paper in the light one), so the type never sits on the picture and needs no scrim.
 */
export function LeadCover({ item }: { readonly item: PublicStoryListItemDoc }) {
  return (
    <article className="ds-stories-lead" data-media={item.heroImage ? 'photo' : 'none'}>
      <div className="ds-stories-lead__media">
        <CoverImage item={item} width={1440} eager />
      </div>
      <div className="ds-wrap ds-stories-lead__wrap">
        <div className="ds-stories-lead__panel" data-ground="ink">
          <p className="ds-stories-lead__years">
            {/* The page's name, visible; the outline's h1 says it for assistive tech. */}
            <span className="ds-stories-lead__page" aria-hidden="true">
              Stories
            </span>
            {item.eraLabel}
          </p>
          <h2 className="ds-stories-lead__title">
            <a className="ds-stories-lead__link" href={href(item)}>
              {item.title}
            </a>
          </h2>
          <p className="ds-stories-lead__dek">{coverDek(item.summary)}</p>
          <a className={buttonClassName('primary', 'ds-stories-lead__cta')} href={href(item)}>
            {readLabel(item)}
          </a>
          {item.heroImage ? (
            <p className="ds-plate__credit ds-stories-lead__credit">
              Cover: {item.heroImage.credit}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** One of the other chapters: a ruled row, the plate beside the title large in ink. */
export function ChapterCover({ item }: { readonly item: PublicStoryListItemDoc }) {
  return (
    <article className="ds-stories-cover">
      <div className="ds-stories-cover__media">
        <CoverImage item={item} width={720} />
      </div>
      <div className="ds-stories-cover__caption">
        <p className="ds-stories-cover__years">{item.eraLabel}</p>
        <h2 className="ds-stories-cover__title">
          <a className="ds-stories-cover__link" href={href(item)}>
            {item.title}
          </a>
        </h2>
        <p className="ds-stories-cover__dek">{coverDek(item.summary)}</p>
        {item.heroImage ? (
          <p className="ds-plate__credit ds-stories-cover__credit">{item.heroImage.credit}</p>
        ) : null}
      </div>
    </article>
  );
}

/** A list row on the paper sheet: a 72px portrait where the data has one, the name large, the
 *  years bold in mono, one line of summary. */
export function StoryRow({ item }: { readonly item: PublicStoryListItemDoc }) {
  const image = item.heroImage;
  // An entry names its place in its collection ("2nd president"); a chapter says it is one.
  const kind = item.collection?.positionLabel ?? (item.format === 'entry' ? 'Entry' : 'Chapter');
  return (
    <li className="ds-stories-row">
      <a className="ds-stories-row__link" href={href(item)}>
        <span className="ds-stories-row__thumb" data-media={image ? 'photo' : 'none'}>
          {image ? (
            <StoryImage
              src={storyImageSrc(image.url, 72, image.width)}
              fallbackSrc={image.url}
              alt=""
              inLink
            />
          ) : (
            <span className="ds-stories-row__initial" aria-hidden="true">
              {item.title.slice(0, 1)}
            </span>
          )}
        </span>
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
 * The one toolbar: All | Chapters | Entries, then Sort. Both are links (the state is the URL), and
 * the Sort menu is a native popover, so the page narrows with JavaScript off.
 */
export function StoriesToolbar({
  formats,
  format,
  sort,
}: {
  readonly formats: readonly {
    readonly value: string;
    readonly label: string;
    readonly href: string;
  }[];
  readonly format: string;
  readonly sort: readonly SortOption[];
}) {
  const current = sort.find((option) => option.current) ?? sort[0];
  return (
    <div className="ds-stories-toolbar">
      <div className="ds-stories-toolbar__controls">
        <Segmented
          label="Show"
          value={format}
          options={formats.map((option) => ({
            value: option.value,
            label: option.label,
            href: option.href,
          }))}
        />
        <FilterButton
          className="ds-stories-toolbar__sort"
          popoverTarget={SORT_MENU_ID}
          aria-label={`Sort: ${current?.label ?? ''}`}
        >
          <SortGlyph />
          {current?.label}
        </FilterButton>
        <div
          className="ds-stories-sort ds-float"
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

/**
 * The pieces of the `/stories` front: the lead cover, the chapter covers, a list row and the one
 * toolbar. Server components; the only client code is StoryImage's load and error state.
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

function CoverImage({
  item,
  width,
  eager = false,
}: {
  readonly item: PublicStoryListItemDoc;
  readonly width: number;
  readonly eager?: boolean;
}) {
  const image = item.heroImage;
  if (!image) return <span className="ds-stories-cover__blank" aria-hidden="true" />;
  return (
    <StoryImage
      className="ds-stories-cover__img"
      src={storyImageSrc(image.url, width, image.width)}
      fallbackSrc={image.url}
      alt=""
      eager={eager}
      inLink
    />
  );
}

/** The newest chapter at full width: its own image, title, dek and year range. */
export function LeadCover({ item }: { readonly item: PublicStoryListItemDoc }) {
  return (
    <article className="ds-stories-lead" data-media={item.heroImage ? 'photo' : 'none'}>
      <div className="ds-stories-lead__media">
        <CoverImage item={item} width={960} eager />
      </div>
      <div className="ds-stories-lead__copy">
        <p className="ds-stories-lead__years">{item.eraLabel}</p>
        <h2 className="ds-stories-lead__title">
          <a className="ds-stories-lead__link" href={href(item)}>
            {item.title}
          </a>
        </h2>
        <p className="ds-stories-lead__dek">{coverDek(item.summary)}</p>
        <a className={buttonClassName('primary', 'ds-stories-lead__cta')} href={href(item)}>
          {readLabel(item)}
        </a>
      </div>
    </article>
  );
}

/** One of the other chapters, image first. The whole card is the link. */
export function ChapterCover({ item }: { readonly item: PublicStoryListItemDoc }) {
  return (
    <article className="ds-stories-cover">
      <div className="ds-stories-cover__media">
        <CoverImage item={item} width={560} />
      </div>
      <h2 className="ds-stories-cover__title">
        <a className="ds-stories-cover__link" href={href(item)}>
          {item.title}
        </a>
      </h2>
      <p className="ds-stories-cover__years">{item.eraLabel}</p>
      <p className="ds-stories-cover__dek">{coverDek(item.summary)}</p>
    </article>
  );
}

/** A ruled list row: portrait thumbnail where the data has one, title, years, one line of summary. */
export function StoryRow({ item }: { readonly item: PublicStoryListItemDoc }) {
  const image = item.heroImage;
  // An entry names its place in its collection ("2nd president"); a chapter says it is one.
  const kind = item.collection?.positionLabel ?? (item.format === 'entry' ? 'Entry' : 'Chapter');
  return (
    <li className="ds-stories-row">
      <a className="ds-stories-row__link" href={href(item)}>
        <span className="ds-stories-row__thumb">
          {image ? (
            <StoryImage
              src={storyImageSrc(image.url, 64, image.width)}
              fallbackSrc={image.url}
              alt=""
              inLink
            />
          ) : null}
        </span>
        <span className="ds-stories-row__title">{item.title}</span>
        <span className="ds-stories-row__years">{item.eraLabel}</span>
        <span className="ds-stories-row__meta">
          <span className="ds-stories-row__kind">{kind}</span>
          <span className="ds-stories-row__summary">{item.summary}</span>
        </span>
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

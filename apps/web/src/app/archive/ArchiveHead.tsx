/**
 * The head every Archive page shares: the list, the timeline and the lens pages (`/law`,
 * `/books`). A title, the count as a sentence, the Map, List and Timeline switch, then the lens
 * chips, which replaced the collections index. Plain links throughout, so it works without
 * script. The map view carries the same switch in its own column.
 */
import React, { type ReactNode } from 'react';
import { Chip, PageTitle, Segmented } from '@repo/ui';
import { destinationById } from '../../lib/nav/destination-registry';
import { recordsHref } from '../../lib/records/records-query';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import './archive-head.css';

void React;

export type ArchiveLens = 'law' | 'books' | 'presidents' | 'inventions';

/** The inventions lens is one filter on the shared model; the others are their own addresses. */
export const INVENTIONS_KIND = 'inventions';

const LENSES: readonly {
  readonly id: ArchiveLens;
  readonly label: string;
  readonly href: string;
}[] = [
  { id: 'law', label: destinationById('law')?.label ?? 'Law', href: '/law' },
  { id: 'books', label: destinationById('books')?.label ?? 'Banned books', href: '/books' },
  {
    id: 'presidents',
    label: destinationById('presidents')?.label ?? 'Presidents',
    href: '/presidents',
  },
  { id: 'inventions', label: 'Inventions', href: recordsHref({ kind: INVENTIONS_KIND }) },
];

export type ArchiveHeadProps = {
  readonly title: string;
  /** The count, as a sentence. */
  readonly dek?: string | undefined;
  /** The view this page is; null on a lens page, whose switch leads back to the whole archive. */
  readonly view: 'list' | 'timeline' | null;
  /** The same filter set in each view. A lens page links the unfiltered archive. */
  readonly hrefs?: { readonly map: string; readonly list: string; readonly timeline: string };
  readonly lens: ArchiveLens | null;
  /** The membership sentence, when the page has one. */
  readonly children?: ReactNode;
};

const WHOLE_ARCHIVE = {
  map: buildExploreHref({ filters: DEFAULT_EXPLORE_FILTERS, ...defaultExploreOverlayState() }),
  list: recordsHref({}),
  timeline: recordsHref({ layout: 'chronology' }),
};

export function ArchiveHead({
  title,
  dek,
  view,
  hrefs = WHOLE_ARCHIVE,
  lens,
  children,
}: ArchiveHeadProps) {
  return (
    <header className="ds-archive-head">
      <PageTitle className="ds-archive-head__title">{title}</PageTitle>
      {dek ? <p className="ds-archive-head__dek">{dek}</p> : null}
      <div className="ds-archive-head__views" data-archive-views>
        <Segmented
          label="Show records as"
          value={view ?? ''}
          options={[
            { value: 'map', label: 'Map', href: hrefs.map },
            { value: 'list', label: 'List', href: hrefs.list },
            { value: 'timeline', label: 'Timeline', href: hrefs.timeline },
          ]}
        />
      </div>
      <nav className="ds-archive-head__lenses" aria-label="Collections in the archive">
        <Chip href={WHOLE_ARCHIVE.list} selected={lens === null}>
          All records
        </Chip>
        {LENSES.map((item) => (
          <Chip key={item.id} href={item.href} selected={lens === item.id}>
            {item.label}
          </Chip>
        ))}
      </nav>
      {children}
    </header>
  );
}

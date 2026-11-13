/**
 * Global not-found page for unknown public routes and missing entities.
 *
 * Utility room: the title, one line naming the two things that actually go wrong, then the exits.
 *
 * The exits are the whole point of the page. `/design-system` was one of them, which sent a lost
 * reader to a component gallery; it is gone. The first exit is the record they left. The archive exit
 * points at `/records`, the old board, not a new room. And `PaletteSeed` hands the path the reader
 * mistyped to the bar's search as a sanitised query, so `⌘K` opens holding their best guess
 * instead of an empty field.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@repo/ui';
import { PaletteSeed } from '../components/shell/PaletteSeed';
import { Room } from '../components/room';
import { loadWalkBackPlace } from './walk-back-place';
import './utility.css';

/**
 * A route that calls `notFound()` renders THIS component, and its own `generateMetadata` result
 * is discarded — so without this the tab on a missed record read `BlackStory`, the layout
 * default, and a reader with several tabs open could not tell the miss from the home page
 * The response is a real 404 and its title must say so.
 *
 * Only the title. Next already emits `<meta name="robots" content="noindex">` for this boundary
 * on its own; declaring it here too just prints the tag twice.
 */
export const metadata: Metadata = {
  title: 'Not found',
};

export default async function NotFound() {
  const back = await loadWalkBackPlace();
  return (
    <Room width="read">
      <PaletteSeed />
      {/* No crumb: the reader is standing on an address that failed, and `/not-found` is not a
          place in the archive they could go back up from. */}
      <PageHeader
        title="That page is not here"
        dek="Either the address has a typo in it, or it names a record the archive has not published."
      />

      <EmptyState
        title="Nothing to show here"
        action={
          <div className="ds-row">
            <Link className="ds-button ds-button--primary" href="/">
              {back?.displayName ?? 'BlackStory'}
            </Link>
            <Link className="ds-button ds-button--secondary" href="/records">
              Find in the archive
            </Link>
            <Link className="ds-button ds-button--secondary" href="/stories">
              Read the chapters
            </Link>
          </div>
        }
      >
        Press <kbd className="ds-kbd">⌘K</kbd> to search. It opens holding what this address was
        trying to say.
      </EmptyState>
    </Room>
  );
}

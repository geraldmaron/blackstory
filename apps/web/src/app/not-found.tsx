/**
 * Global not-found page for unknown public routes and missing entities.
 *
 * v9 Utility room (design-direction-v9-surfaces.md §"/_not-found"): a kicker, the title, one
 * serif line naming the two things that actually go wrong, then four exits.
 *
 * The kicker is a sentence, not the numeral. It was `404` while the register was mono caps and
 * the numeral carried; in the quiet sentence-case sans the kicker now takes, a bare `404` reads
 * as a stray fragment above the title rather than as the name of what happened.
 *
 * The exits are the whole point of the page. `/design-system` was one of them, which sent a lost
 * reader to a component gallery; it is gone. The first exit is the record they left. The archive exit
 * points at `/records`, the old board, not a new room. And `PaletteSeed` hands the path the reader
 * mistyped to the bar's search as a sanitised query, so `⌘K` opens holding their best guess
 * instead of an empty field.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import { PaletteSeed } from '../components/shell/PaletteSeed';
import { Room } from '../components/room/Room';
import { RoomHeader } from '../components/room/RoomHeader';
import { loadWalkBackPlace } from './walk-back-place';
import './utility.css';

/**
 * A route that calls `notFound()` renders THIS component, and its own `generateMetadata` result
 * is discarded — so without this the tab on a missed record read `BlackStory`, the layout
 * default, and a reader with several tabs open could not tell the miss from the home page
 * (repo-n7p6.29). The status was already a real 404; only the title was lying.
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
    <Room>
      <PaletteSeed />
      <RoomHeader
        pathname="/not-found"
        kicker="Nothing at this address"
        title="That page is not here"
        lede="Either the address has a typo in it, or it names a record the archive has not published."
        /* Every other room prints its own route as a mono fact because readers cite URLs. This
           room's route is not the reader's route — they are standing on the address that failed,
           and `/not-found` is a path that does not resolve. Printing it twice, once as a crumb
           and once as a fact, tells a lost reader where they are not. */
        showPath={false}
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

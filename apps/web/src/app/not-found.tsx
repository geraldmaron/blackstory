/**
 * Global not-found page for unknown public routes and missing entities.
 *
 * v9 Utility room (design-direction-v9-surfaces.md §"/_not-found"): a mono `404` kicker, the
 * title, one serif line naming the two things that actually go wrong, then four exits.
 *
 * The exits are the whole point of the page. `/design-system` was one of them, which sent a lost
 * reader to a component gallery; it is gone. The archive exit points at `/records`, a list, rather
 * than at the Atlas, where the list is behind a map. And `PaletteSeed` hands the path the reader
 * mistyped to the bar's search as a sanitised query, so `⌘K` opens holding their best guess
 * instead of an empty field.
 */

import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import { PaletteSeed } from '../components/shell/PaletteSeed';
import { Room, RoomHeader } from '../components/room';
import './utility.css';

export default function NotFound() {
  return (
    <Room>
      <PaletteSeed />
      <RoomHeader
        pathname="/not-found"
        kicker="404"
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
            <Link className="ds-button ds-button--primary" href="/records">
              Find in the archive
            </Link>
            <Link className="ds-button ds-button--secondary" href="/">
              Open the Atlas
            </Link>
            <Link className="ds-button ds-button--secondary" href="/chapters">
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

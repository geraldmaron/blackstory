/**
 * Global not-found page for unknown public routes and missing entities.
 *
 * A utility room in the living-archive system: a sand mast with the title at display weight and
 * one line naming the two things that actually go wrong, then the exits on the table's ground.
 *
 * The exits are the whole point of the page. `/design-system` was one of them, which sent a lost
 * reader to a component gallery; it is gone. The first exit is the map the reader came from. The
 * archive exit points at `/records`, the old board, not a new room. And `PaletteSeed` hands the
 * path the reader mistyped to the bar's search as a sanitised query, so `⌘K` opens holding their
 * best guess instead of an empty field.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { PaletteSeed } from '../components/shell/PaletteSeed';
import { Room } from '../components/room';
import { TrustMast, TrustSheet } from '../components/trust';
import { loadWalkBackPlace, MAP_BACK } from './walk-back-place';
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
  // The site's own name says nothing about where the button goes; the map is where it goes.
  const backLabel =
    back.displayName === MAP_BACK.displayName ? 'Back to the map' : `Back to ${back.displayName}`;
  return (
    <Room
      width="read"
      className="ds-trust-room"
      masthead={
        // No crumb: the reader is standing on an address that failed, and `/not-found` is not a
        // place in the archive they could go back up from.
        <TrustMast>
          <PageHeader
            display
            title="That page isn’t here"
            dek="Either the address has a typo in it, or it names a record the archive hasn’t published."
          />
        </TrustMast>
      }
    >
      <PaletteSeed />
      <TrustSheet>
        <ul className="ds-utility-exits" aria-label="Where to go next">
          <li className="ds-utility-exits__row ds-utility-exits__row--primary">
            <Link className="ds-button ds-button--primary" href="/">
              {backLabel}
            </Link>
            <p className="ds-utility-exits__line">The map is where the archive starts.</p>
          </li>
          <li className="ds-utility-exits__row">
            <Link className="ds-utility-exits__link" href="/archive">
              Find in the archive
            </Link>
            <p className="ds-utility-exits__line">Every published record, searchable.</p>
          </li>
          <li className="ds-utility-exits__row">
            <Link className="ds-utility-exits__link" href="/stories">
              Read the chapters
            </Link>
            <p className="ds-utility-exits__line">Long reads built from the records.</p>
          </li>
        </ul>
        <p className="ds-utility-exits__search">
          <span className="ds-utility-exits__keys">
            Press <kbd className="ds-kbd">⌘K</kbd> to search.
          </span>
          <span className="ds-utility-exits__touch">Tap search at the top to look it up.</span> It
          opens with what this address was looking for already typed in.
        </p>
      </TrustSheet>
    </Room>
  );
}

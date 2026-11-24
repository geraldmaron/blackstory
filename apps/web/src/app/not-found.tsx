/**
 * Global not-found page for unknown public routes and missing records: the paper document frame,
 * one sentence, and the way back (docs/ui/DESIGN.md section 8, System).
 *
 * `PaletteSeed` hands the path the reader mistyped to the bar's search as a sanitised query, so
 * search opens holding their best guess instead of an empty field.
 */

import type { Metadata } from 'next';
import { Button, PageHeader } from '@repo/ui';
import { PaletteSeed } from '../components/shell/PaletteSeed';
import { PageFrame } from '../components/page';
import { TrustMast, TrustSheet } from '../components/trust';
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

export default function NotFound() {
  return (
    <PageFrame
      width="read"
      className="ds-trust-doc"
      masthead={
        // No crumb: the reader is standing on an address that failed, and `/not-found` is not a
        // place in the archive they could go back up from.
        <TrustMast>
          <PageHeader
            display
            title="That page isn’t here"
            dek="The address has a typo in it, or it names a record the archive hasn’t published."
          />
        </TrustMast>
      }
    >
      <PaletteSeed />
      <TrustSheet>
        <p className="ds-utility-ways">
          <Button href="/">Back to the front page</Button>
          <Button href="/archive" variant="quiet">
            Search the archive
          </Button>
        </p>
      </TrustSheet>
    </PageFrame>
  );
}

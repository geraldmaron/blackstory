/**
 * `/entity/{id}`'s own loading state — the record page's skeleton, not a different page.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §"The entity loading state". Next
 * renders this in place of `EntityPage` while `resolvePublicEntityView` is still in flight, so
 * it has no `entity` to read and must reserve the record's geometry from the room kit's own
 * classes instead of guessing at sizes of its own.
 *
 * What gets a shimmer block, and why that list stops where it does: the design law names four
 * things — the kicker (the kind pill), the name, the summary and the five anatomy tiles — and
 * this file mirrors only those, in the exact markup the masthead figure and the fact strip
 * already render them in (`EntityRecordRoom.tsx`). The breadcrumb and the fact strip's two CTAs
 * are left out on purpose: the design law's own inventory does not list them, and there is
 * nothing route-specific to shimmer for either (a breadcrumb needs the entity's own name, a CTA
 * needs its own href). `data-media="mark"` is the mark layout, not the photo one, because most
 * records fall back to the kind mark (`EntityRecordRoom.tsx`'s own comment: roughly nine in ten)
 * — the minority with a rights-cleared photo still reflows into the taller photo masthead, which
 * a route-level loading state cannot see coming without the record it is waiting for.
 *
 * Never a spinner. The shimmer is `.ds-sk` (`components/patterns/skeleton.css`), whose own
 * `@media (prefers-reduced-motion: reduce)` rule is what turns it static — a plain CSS media
 * query is live by construction (the engine re-evaluates it the moment the OS preference
 * changes, no reload, no listener) rather than the one-shot `matchMedia(...).matches` read the
 * design law warns against. That is also why this file carries no `'use client'`: nothing here
 * needs a render to react to the preference changing.
 *
 * One region, one announcement. `aria-busy` sits on the wrapper for the whole wait; the single
 * "Opening record" line is its own visually-hidden `aria-live="polite"` node so a screen reader
 * reports it once, not once per shimmer block. Every shimmer block is `aria-hidden`.
 */
import React from 'react';
import { Room } from '../../../components/room';
import '../../../components/patterns/skeleton.css';
import './record-room.css';

void React;

/** Kept in one place so the geometry test can pin it to the real component's own tile count
 * (`RecordFactTile` call sites in `EntityRecordRoom.tsx`) instead of a second, hand-typed "5". */
export const ENTITY_LOADING_ANATOMY_TILE_COUNT = 5;

export default function EntityLoading() {
  return (
    <div aria-busy="true">
      <p className="ds-visually-hidden" role="status" aria-live="polite">
        Opening record
      </p>
      <Room
        masthead={
          <>
            <figure className="ds-record-mast" data-media="mark" aria-hidden="true">
              <div className="ds-record-mast__over">
                <div className="ds-rec-pills">
                  <span className="ds-rec-pill ds-rec-pill--kind">
                    <span className="ds-sk ds-rec-skel--kicker" />
                  </span>
                </div>
                <h1 className="ds-record-mast__title">
                  <span className="ds-sk ds-rec-skel--title ds-sk--w-60" />
                </h1>
                <p className="ds-record-mast__lede">
                  <span className="ds-sk ds-rec-skel--lede ds-sk--w-full" />
                  <span className="ds-sk ds-rec-skel--lede ds-sk--w-80" />
                </p>
              </div>
            </figure>

            <div className="ds-rec-facts">
              <dl className="ds-rec-facts__tiles">
                {Array.from({ length: ENTITY_LOADING_ANATOMY_TILE_COUNT }, (_, index) => (
                  <div className="ds-rec-tile" key={index}>
                    <dt className="ds-rec-tile__label">
                      <span className="ds-rec-tile__icon ds-sk" />
                      <span className="ds-sk ds-sk--text ds-sk--w-40" />
                    </dt>
                    <dd className="ds-rec-tile__value">
                      <span className="ds-sk ds-sk--title ds-sk--w-80" />
                    </dd>
                    <dd className="ds-rec-tile__support">
                      <span className="ds-sk ds-sk--text ds-sk--w-60" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        }
      >
        {null}
      </Room>
    </div>
  );
}

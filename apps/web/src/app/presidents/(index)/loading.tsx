import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../../components/room';
import { TrustMast, TrustSheet } from '../../../components/trust';
import '../../stories/stories.css';

void React;

/** The list's shape, held still while it loads: the page's own mast, then the sheet with its rows. */
export default function Loading() {
  return (
    <Room
      width="wide"
      className="ds-trust-room ds-stories ds-presidents"
      masthead={
        <TrustMast>
          <PageHeader display crumb={parentCrumb('/presidents')} linkAs={Link} title="Presidents" />
        </TrustMast>
      }
    >
      <TrustSheet className="ds-stories-paper">
        <div className="ds-stories-wait" aria-busy="true">
          <p className="ds-visually-hidden" role="status">
            Loading the presidents
          </p>
          <span className="ds-stories-wait__rows" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
      </TrustSheet>
    </Room>
  );
}

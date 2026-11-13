import React from 'react';
import { Sheet } from '@repo/ui';
import { Room } from '../../components/room';
import './stories.css';

void React;

/** The front's own shape, held still while the list loads: the ink lead, a sand and a copper
 *  tile, and the paper sheet with its rows. */
export default function Loading() {
  return (
    <Room
      width="wide"
      className="ds-stories"
      masthead={<span className="ds-stories-wait__lead" aria-hidden="true" />}
    >
      <div className="ds-stories-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading stories
        </p>
        <span className="ds-stories-wait__covers" aria-hidden="true">
          <span />
          <span />
        </span>
        <Sheet className="ds-stories-paper" aria-hidden="true">
          <span className="ds-stories-wait__rows">
            <span />
            <span />
            <span />
            <span />
          </span>
        </Sheet>
      </div>
    </Room>
  );
}

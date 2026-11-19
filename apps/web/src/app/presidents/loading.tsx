import React from 'react';
import { Sheet } from '@repo/ui';
import { Room } from '../../components/room';
import '../stories/stories.css';

void React;

/** The list's shape, held still while it loads: the paper sheet with its rows. */
export default function Loading() {
  return (
    <Room width="wide" className="ds-stories ds-presidents">
      <div className="ds-stories-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading the presidents
        </p>
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

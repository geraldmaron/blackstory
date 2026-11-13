import React from 'react';
import { Room } from '../../components/room';
import './stories.css';

void React;

/** The front's own shape, quiet, while the list loads: a cover, two covers, ruled rows. */
export default function Loading() {
  return (
    <Room width="wide" className="ds-stories">
      <div className="ds-stories-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading stories
        </p>
        <span className="ds-stories-wait__lead" aria-hidden="true" />
        <span className="ds-stories-wait__covers" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="ds-stories-wait__rows" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </div>
    </Room>
  );
}

import React from 'react';
import { Sheet } from '@repo/ui';
import { Room } from '../../../components/room';
import '../../../components/story/story.css';

void React;

/** The story frame's own shape, held still while the piece loads: the title lines on the table, the
 *  copper facts band, then the paper sheet with text lines. */
export default function Loading() {
  return (
    <Room width="wide" className="ds-story">
      <div className="ds-story-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading the entry
        </p>
        <span className="ds-story-wait__line ds-story-wait__line--title" aria-hidden="true" />
        <span className="ds-story-wait__line" aria-hidden="true" />
        <span className="ds-story-wait__line ds-story-wait__line--short" aria-hidden="true" />
        <span className="ds-story-wait__band" aria-hidden="true" />
        <Sheet className="ds-story-wait__sheet" aria-hidden="true">
          <span className="ds-story-wait__line" />
          <span className="ds-story-wait__line" />
          <span className="ds-story-wait__line ds-story-wait__line--short" />
        </Sheet>
      </div>
    </Room>
  );
}

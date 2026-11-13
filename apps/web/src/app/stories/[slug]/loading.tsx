import React from 'react';
import { Room } from '../../../components/room';
import '../../../components/story/story.css';

void React;

/** The story frame's own shape, quiet, while the piece loads: masthead lines, then text lines. */
export default function Loading() {
  return (
    <Room width="wide" className="ds-story">
      <div className="ds-story-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading the story
        </p>
        <span className="ds-story-wait__line ds-story-wait__line--facts" aria-hidden="true" />
        <span className="ds-story-wait__line ds-story-wait__line--title" aria-hidden="true" />
        <span className="ds-story-wait__line" aria-hidden="true" />
        <span className="ds-story-wait__line" aria-hidden="true" />
        <span className="ds-story-wait__line ds-story-wait__line--short" aria-hidden="true" />
      </div>
    </Room>
  );
}

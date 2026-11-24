import React from 'react';
import { PageFrame } from '../../../components/page';
import '../stories.css';

void React;

/** The stories list's shape, held still while it loads. Inside the `(index)` group so it never
 *  wraps a story page, which must read without script. */
export default function Loading() {
  return (
    <PageFrame width="wide" className="ds-stories">
      <div className="ds-stories-wait" aria-busy="true">
        <p className="ds-visually-hidden" role="status">
          Loading stories
        </p>
        <span className="ds-stories-wait__rows" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </PageFrame>
  );
}

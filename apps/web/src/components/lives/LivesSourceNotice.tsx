import React from 'react';
import { Notice } from '@repo/ui';
import type { LivesAreaSource } from '../../lib/lives/lives-source';

void React;

export type LivesSourceNoticeProps = {
  readonly source: LivesAreaSource;
  readonly areaName: string;
  /** Same-page address for a native reload; the notice is a link, not a script. */
  readonly retryHref: string;
};

/**
 * Tells a reader why every figure reads as not yet counted. Nothing published is a plain fact about
 * the release; an unreadable snapshot is a failure. Neither is presented as a zero count.
 */
export function LivesSourceNotice({ source, areaName, retryHref }: LivesSourceNoticeProps) {
  if (source === 'snapshot') return null;
  if (source === 'unpublished') {
    return (
      <div className="lives-source-notice">
        <Notice tone="warning" title="No counts published for this area yet">
          This release has no published snapshot for {areaName}. Every figure below reads as not yet
          counted, which is different from a count of zero.
        </Notice>
      </div>
    );
  }
  return (
    <div className="lives-source-notice">
      <Notice tone="error" title="These counts could not be read">
        The stored snapshot for {areaName} is unavailable right now, so no figure below is shown as
        counted. Nothing here is a count of zero.{' '}
        <a className="lives-source-notice__retry" href={retryHref}>
          Try again
        </a>
      </Notice>
    </div>
  );
}

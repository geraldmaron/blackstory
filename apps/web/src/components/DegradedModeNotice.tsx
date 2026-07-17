/**
 * Server banner that surfaces BB-022's snapshot-only degraded posture
 * (`PUBLIC_READ_API_DISABLED=1`) — distinct from `OfflineNotice`'s client-side
 * connectivity check. Renders nothing when live reads are not disabled.
 */

import React from 'react';
import { Notice } from '@black-book/ui';
import { isPublicReadApiDisabled } from '../lib/runtime-hardening/degraded-mode';

export function DegradedModeNotice() {
  if (!isPublicReadApiDisabled()) {
    return null;
  }

  return (
    <div className="bb-shell-offline" role="status">
      <Notice tone="warning" title="Showing snapshot data">
        Live reads are temporarily disabled by the operator. Pages are serving the last published
        release snapshot.
      </Notice>
    </div>
  );
}

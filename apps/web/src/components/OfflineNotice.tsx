/**
 * Client banner that surfaces an offline degraded connectivity notice.
 */

'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@blap/ui';

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      setOffline(!window.navigator.onLine);
    }
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div className="bp-shell-offline" role="status">
      <Notice tone="warning" title="You appear to be offline">
        Browse pages already loaded on this device. Search and entity links may fail until
        connectivity returns.
      </Notice>
    </div>
  );
}

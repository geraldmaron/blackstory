/**
 * Segment error boundary for public routes. v9 utility room with design-system Notice.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../lib/runtime-hardening/error-surface';
import { Room } from '../components/room/Room';
import { RoomHeader } from '../components/room/RoomHeader';
import './utility.css';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const display = sanitizeClientErrorDisplay(error);

  return (
    <Room>
      <RoomHeader
        pathname="/error"
        kicker="Error"
        title="Something went wrong"
        lede="The public shell hit an unexpected error. You can retry or return home."
      />

      <Notice tone="error" title={display.title}>
        {display.detail}
      </Notice>
      <div className="ds-row">
        <button type="button" className="ds-button ds-button--primary" onClick={reset}>
          Try again
        </button>
        <Link className="ds-button ds-button--secondary" href="/">
          Back to home
        </Link>
      </div>
    </Room>
  );
}

/**
 * Segment error boundary for public routes. v9 utility room with design-system Notice.
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Notice, PageHeader } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../lib/runtime-hardening/error-surface';
import { Room } from '../components/room';
import './utility.css';

void React;

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
    <Room width="read">
      <PageHeader
        title="Something went wrong"
        dek="The public shell hit an unexpected error. You can retry or return home."
      />

      <Notice tone="error" title={display.title}>
        {display.detail}
      </Notice>
      <div className="ds-row" style={{ marginTop: 'var(--ds-space-4)' }}>
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

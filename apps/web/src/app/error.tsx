/**
 * Segment error boundary for public routes uses design-system Notice.
 */

'use client';

import React, { useEffect } from 'react';
import { Notice } from '@repo/ui';
import { StatusPage } from '../components/StatusPage';
import { sanitizeClientErrorDisplay } from '../lib/runtime-hardening/error-surface';

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
    <StatusPage
      eyebrow="Error"
      title="Something went wrong"
      lede="The public shell hit an unexpected error. You can retry or return home."
    >
      <div className="ds-stack ds-page--status__body">
        <Notice tone="error" title={display.title}>
          {display.detail}
        </Notice>
        <div className="ds-row">
          <button type="button" className="ds-button ds-button--primary" onClick={reset}>
            Try again
          </button>
          <a className="ds-button ds-button--secondary" href="/">
            Back to home
          </a>
        </div>
      </div>
    </StatusPage>
  );
}

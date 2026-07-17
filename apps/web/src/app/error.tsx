/**
 * Segment error boundary for public routes uses design-system Notice.
 */

'use client';

import React, { useEffect } from 'react';
import { Notice } from '@black-book/ui';
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
      <div className="bb-stack bb-page--status__body">
        <Notice tone="error" title={display.title}>
          {display.detail}
        </Notice>
        <div className="bb-row">
          <button type="button" className="bb-button bb-button--primary" onClick={reset}>
            Try again
          </button>
          <a className="bb-button bb-button--secondary" href="/">
            Back to home
          </a>
        </div>
      </div>
    </StatusPage>
  );
}

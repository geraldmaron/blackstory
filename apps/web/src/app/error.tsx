/**
 * Segment error boundary for public routes — uses design-system Notice.
 */

'use client';

import { useEffect } from 'react';
import { Notice } from '@black-book/ui';

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

  return (
    <main className="bb-container bb-page" id="main">
      <h1 className="bb-page__title">Something went wrong</h1>
      <p className="bb-page__lede">
        The public shell hit an unexpected error. You can retry or return home.
      </p>
      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-6)' }}>
        <Notice tone="error" title="Page failed to render">
          {error.digest ? (
            <span className="bb-mono">digest {error.digest}</span>
          ) : (
            'A transient client or server fault interrupted this view.'
          )}
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
    </main>
  );
}

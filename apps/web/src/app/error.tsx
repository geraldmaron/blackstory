/**
 * Segment error boundary for public routes: the same paper document frame as the 404, the failure
 * in one sentence, then the two ways on. The sanitized detail sits in a Notice under the title.
 */

'use client';

import React, { useEffect } from 'react';
import { Button, Notice, PageHeader } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../lib/runtime-hardening/error-surface';
import { PageFrame } from '../components/page';
import { TrustMast, TrustSheet } from '../components/trust/TrustFrame';
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
    <PageFrame
      width="read"
      className="ds-trust-doc"
      masthead={
        <TrustMast>
          <PageHeader
            display
            title="This page failed to load"
            dek="That is a fault in the site, not in the record."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <Notice tone="error" title={display.title}>
          {display.detail}
        </Notice>
        {/* A plain anchor on purpose: the router may be what failed. */}
        <p>
          If it keeps happening, <a href="/support">tell us on the support page</a>
          {display.digest
            ? ' and include the reference above, which lets us find what went wrong.'
            : '.'}
        </p>
        <p className="ds-utility-ways">
          <Button onClick={reset}>Try again</Button>
          {/* A plain anchor on purpose: the router may be what failed. */}
          <Button href="/" variant="quiet">
            Back to the front page
          </Button>
        </p>
      </TrustSheet>
    </PageFrame>
  );
}

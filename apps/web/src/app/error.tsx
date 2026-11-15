/**
 * Segment error boundary for public routes: the same sand mast as the 404, the failure in plain
 * words, then the two ways on. The sanitized detail sits in a Notice under the mast.
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Notice, PageHeader } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../lib/runtime-hardening/error-surface';
import { Room } from '../components/room';
import { TrustMast } from '../components/trust/TrustFrame';
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
    <Room
      width="read"
      masthead={
        <TrustMast tone="sand">
          <PageHeader
            display
            title="This page failed to load"
            dek="That is a fault in the site, not in the record. Try again, or go back to the map."
          />
        </TrustMast>
      }
    >
      <div className="ds-utility-exits">
        <Notice tone="error" title={display.title}>
          {display.detail}
        </Notice>
        <div className="ds-row">
          <button type="button" className="ds-button ds-button--primary" onClick={reset}>
            Try again
          </button>
          <Link className="ds-button ds-button--secondary" href="/">
            Back to the map
          </Link>
        </div>
      </div>
    </Room>
  );
}

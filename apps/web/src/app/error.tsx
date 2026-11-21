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
    <Room
      width="read"
      className="ds-trust-room"
      masthead={
        <TrustMast art={['contours']}>
          <PageHeader
            display
            title="This page failed to load"
            dek="That is a fault in the site, not in the record. Try again, or go back to the map."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <Notice tone="error" title={display.title}>
          {display.detail}
        </Notice>
        <ul className="ds-utility-exits" aria-label="Where to go next">
          <li className="ds-utility-exits__row ds-utility-exits__row--primary">
            <button type="button" className="ds-button ds-button--primary" onClick={reset}>
              Try again
            </button>
            <p className="ds-utility-exits__line">Loads this page once more.</p>
          </li>
          <li className="ds-utility-exits__row">
            <Link className="ds-utility-exits__link" href="/">
              Back to the map
            </Link>
            <p className="ds-utility-exits__line">The map is where the archive starts.</p>
          </li>
        </ul>
      </TrustSheet>
    </Room>
  );
}

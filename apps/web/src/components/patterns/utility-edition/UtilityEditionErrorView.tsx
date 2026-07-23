/**
 * Utility v6 error view for the segment error boundary. CSS is imported by the
 * route module (`app/error.tsx`) so SSR unit tests can import this file safely.
 */
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../../../lib/runtime-hardening/error-surface';
import { UtilityEditionBodyPanel } from './UtilityEditionBodyPanel';
import { UtilityEditionIntro } from './UtilityEditionIntro';
import { UtilityEditionShell } from './UtilityEditionShell';

export type UtilityEditionErrorViewProps = {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
};

export function UtilityEditionErrorView({ error, reset }: UtilityEditionErrorViewProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const display = sanitizeClientErrorDisplay(error);

  return (
    <UtilityEditionShell mosaicSeed="error-edition-v6" editionKey="error">
      <UtilityEditionIntro
        kicker="Error"
        title="Something went wrong"
        lede="The public shell hit an unexpected error. You can retry or return home."
        variant="status"
      />
      <UtilityEditionBodyPanel>
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
      </UtilityEditionBodyPanel>
    </UtilityEditionShell>
  );
}

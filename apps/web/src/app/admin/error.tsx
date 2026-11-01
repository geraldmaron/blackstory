/**
 * Error boundary for every staff desk. Without it the desks inherit the public boundary, whose copy
 * talks about the public shell and whose way out leads to the public home. This one stays inside the
 * staff shell: retry, or return to the operations desk. Detail goes through the same sanitizer as the
 * public boundary, so no stack or internal message reaches the page. It changes no auth behavior;
 * the proxy and the layout still decide who can reach a desk at all.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Notice } from '@repo/ui';
import { sanitizeClientErrorDisplay } from '../../lib/runtime-hardening/error-surface';
import { DeskTitleBar } from '../../admin/design-system/ui';

void React;

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const display = sanitizeClientErrorDisplay(error);

  return (
    <main className="ds-container" id="main">
      <DeskTitleBar
        eyebrow="Administration"
        title="This desk could not load"
        description="Try again, or return to the operations desk."
      />
      <Notice tone="error" title={display.title}>
        {display.detail}
      </Notice>
      <div className="ds-row">
        <button type="button" className="ds-button ds-button--primary" onClick={reset}>
          Try again
        </button>
        <Link className="ds-button ds-button--secondary" href="/admin">
          Back to the operations desk
        </Link>
      </div>
    </main>
  );
}

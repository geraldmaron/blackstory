/**
 * Client scroll helper: `/how-it-works?s=about|methodology|data|law|books|lives` lands on the
 * matching section after paint.
 */
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function HubSectionFocus() {
  const params = useSearchParams();
  useEffect(() => {
    const section = params.get('s');
    if (!section) return;
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      if (typeof el.focus === 'function') {
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
      }
    }
  }, [params]);
  return null;
}

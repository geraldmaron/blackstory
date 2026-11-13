'use client';

/**
 * Opens the answer a link points at. A deep link to `/faq#do-i-need-an-account` lands on a
 * closed disclosure otherwise; browsers that open a targeted `<details>` on their own are
 * unaffected, and with JavaScript off the question is still scrolled to.
 */
import { useEffect } from 'react';

export function FaqHashOpener() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLDetailsElement && !target.open) {
        target.open = true;
        target.scrollIntoView({ block: 'start' });
      }
    }
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}

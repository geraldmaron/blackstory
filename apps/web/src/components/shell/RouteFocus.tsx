'use client';

/**
 * Moves focus to the page's `<main>` after a client-side navigation.
 *
 * The app had no focus management on route change at all. Activating a link left the caret on
 * the link, inside a header that stays mounted across navigations, so a keyboard user arrived
 * at a new page with focus still in the bar and had to tab past the whole of it — or, when the
 * link unmounted, with focus reset to `<body>` and no position at all.
 *
 * Next's own route announcer already reads the new document title, so this deliberately does
 * not add a live region: announcing here as well would say the page twice.
 *
 * Three things it refuses to do, because a blanket "focus main on every render" breaks more
 * than it fixes:
 *
 *  - It does not fire on first load. Stealing focus from the top of a freshly opened page is
 *    its own bug, and there is nothing to restore from.
 *  - It ignores query-only changes. `/explore` writes its camera, filters and selection into
 *    the URL continuously; treating those as navigations would yank focus out of the
 *    instrument mid-interaction. Only a real pathname change counts.
 *  - It yields to anything modal. If focus is already inside an open dialog or sheet when the
 *    route settles, that surface owns the caret and this leaves it alone.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** `<main>` is not focusable by default; it needs a programmatic-only tab stop. */
function focusMain() {
  const main = document.querySelector<HTMLElement>('main#main') ?? document.querySelector('main');
  if (!main) return;
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

function focusIsInsideModal() {
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  return Boolean(active.closest('[role="dialog"], [aria-modal="true"], dialog[open]'));
}

export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const prior = previous.current;
    previous.current = pathname;
    if (prior === null || prior === pathname) return;
    if (focusIsInsideModal()) return;
    focusMain();
  }, [pathname]);

  return null;
}

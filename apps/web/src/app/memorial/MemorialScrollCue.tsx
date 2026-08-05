/**
 * The memorial opening screen's scroll cue: a real, keyboard-reachable link
 * down to the full name list, enhanced to scroll smoothly instead of jumping.
 * Kept as an `<a href="#memorial-names">` (not a `<button>`) so it still works
 * as plain in-page navigation without JS; the click handler only upgrades
 * that jump to a smooth scroll and takes over focus placement itself.
 */
'use client';

import React from 'react';

void React;

export type MemorialScrollCueProps = {
  readonly targetId: string;
  readonly label: string;
  /**
   * Spoken name for the link, when the visible label is too short to say where
   * it goes on its own. "Read more" reads fine beneath the held message, which
   * supplies the context visually, but a screen reader listing links out of
   * context would announce it with nothing to distinguish it.
   */
  readonly accessibleLabel?: string;
  readonly className?: string;
};

export function MemorialScrollCue({
  targetId,
  label,
  accessibleLabel,
  className,
}: MemorialScrollCueProps) {
  const cueRef = React.useRef<HTMLAnchorElement>(null);

  /**
   * Takes the reader to the name list. Shared by the click handler and the
   * automatic scroll, so there is exactly one scroll path on this page: the
   * settle-and-re-aim logic below exists because the target moves while the
   * wall packs, and that is true however the scroll was started.
   */
  const scrollToTarget = React.useCallback(() => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
    target.scrollIntoView({ behavior, block: 'start' });

    // Reduced motion still needs the settle loop when the document has not been
    // laid out yet: the cut above lands nowhere on a zero-height page, and a
    // reader on reduced motion deserves to arrive at the list just the same.
    if (reducedMotion && document.documentElement.scrollHeight > window.innerHeight) {
      target.focus({ preventScroll: true });
      return;
    }

    /*
     * Re-aim, then focus.
     *
     * `scrollIntoView` resolves its destination once, at call time, and does not
     * follow the target afterwards. On this page the target moves: clicking the
     * cue in the first seconds after load races the wall measuring itself and
     * the fonts settling, and the document grows by several hundred pixels
     * underneath the animation. The scroll then lands short, or the browser's
     * scroll anchoring cancels it outright and the page does not move at all —
     * which is exactly the "click it as soon as it loads and nothing happens"
     * case.
     *
     * So after each scroll settles, check where the target actually ended up and
     * aim again if it is not where it should be. Bounded by SETTLE_ATTEMPTS so a
     * target that keeps moving cannot loop forever.
     */
    const SETTLE_ATTEMPTS = 4;
    const TOLERANCE_PX = 4;
    /* Polled at LAYOUT_POLL_MS, so this is a ~2.4s ceiling on waiting for the
       names to lay out before giving up rather than scrolling somewhere wrong. */
    const LAYOUT_WAITS = 24;
    const LAYOUT_POLL_MS = 100;
    let attempts = 0;
    let waits = 0;
    let done = false;

    const desiredTop = () => {
      const marginTop = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      return marginTop;
    };

    /*
     * Has the document been laid out yet?
     *
     * This is not paranoia. The automatic scroll starts the instant the wall
     * anchors the cue, and at that moment `scrollHeight` is still 0 — the wall
     * has measured itself but the names below have not been laid out. A zero
     * height makes the `atPageEnd` test below read `innerHeight >= -4`, i.e.
     * "already at the foot of the page", so the loop concluded there was
     * nowhere to scroll and focused the target without moving. The page sat at
     * the top with focus mysteriously on the list.
     *
     * A document shorter than the viewport genuinely cannot scroll, so this
     * doubles as the honest version of that check.
     */
    const measured = () => document.documentElement.scrollHeight > window.innerHeight;

    const settle = () => {
      if (done) {
        return;
      }
      window.removeEventListener('scrollend', settle);
      window.clearTimeout(fallback);

      /*
       * Waiting for the document to exist is not a failed attempt. Counting it
       * as one burns the retry budget on the very churn the budget exists to
       * ride out, which is how the automatic scroll gave up before the page had
       * finished building. `waits` is its own, larger budget.
       */
      if (!measured()) {
        waits += 1;
        if (waits < LAYOUT_WAITS) {
          schedule(LAYOUT_POLL_MS);
          return;
        }
        done = true;
        return;
      }

      // First real chance to move: the scroll issued before the document had a
      // height went nowhere, so re-issue it now that there is somewhere to go.
      if (window.scrollY === 0 && attempts === 0) {
        target.scrollIntoView({ behavior, block: 'start' });
        schedule();
        return;
      }

      const atRest = Math.abs(target.getBoundingClientRect().top - desiredTop()) <= TOLERANCE_PX;
      const atPageEnd =
        Math.ceil(window.scrollY + window.innerHeight) >=
        document.documentElement.scrollHeight - TOLERANCE_PX;
      attempts += 1;

      if (!atRest && !atPageEnd && attempts < SETTLE_ATTEMPTS) {
        /*
         * Close the measured gap rather than re-running `scrollIntoView`.
         * scrollIntoView recomputes its destination from scratch and lands on
         * whatever the layout says at that instant, which is how the automatic
         * scroll kept stopping exactly one `scroll-margin-top` short. The delta
         * is already known here, so scroll by it.
         *
         * Snap rather than animate: the reader has already watched one scroll,
         * and a second animation reads as the page fighting them.
         */
        window.scrollBy({
          top: target.getBoundingClientRect().top - desiredTop(),
          behavior: attempts === 1 ? 'smooth' : 'auto',
        });
        schedule();
        return;
      }

      done = true;
      target.focus({ preventScroll: true });
    };

    // `scrollend` is the precise signal; the timeout covers browsers without it,
    // and the case where the scroll never starts (already at the destination, or
    // cancelled before it moved) so no scrollend ever fires.
    let fallback = 0;
    function schedule(delay = 700) {
      fallback = window.setTimeout(settle, delay);
      window.addEventListener('scrollend', settle, { once: true });
    }
    schedule(measured() ? 700 : LAYOUT_POLL_MS);
  }, [targetId]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!document.getElementById(targetId)) {
      return;
    }
    event.preventDefault();
    scrollToTarget();
  };

  /*
   * Scroll automatically as soon as the cue is available.
   *
   * `MemorialWallAtmosphere` sets `data-anchored` on this element once it has
   * measured the held message and moved the cue off its 60vh CSS fallback to
   * its real resting place. That is the moment the cue is genuinely available,
   * so that is when the page goes down to the list on the reader's behalf.
   *
   * The attribute may already be set before this effect runs (the packer
   * measures synchronously on mount), so check first and only observe if it
   * has not landed yet. `fired` makes this once-per-load: the packer rebuilds
   * on every resize and re-sets the attribute each time, and a page that
   * scrolls itself back down whenever the window changes size is a trap.
   */
  React.useEffect(() => {
    const cue = cueRef.current;
    if (!cue) {
      return;
    }

    let fired = false;
    const fire = () => {
      if (fired) {
        return;
      }
      fired = true;
      scrollToTarget();
    };

    if (cue.dataset.anchored === 'true') {
      fire();
      return;
    }

    const observer = new MutationObserver(() => {
      if (cue.dataset.anchored === 'true') {
        observer.disconnect();
        fire();
      }
    });
    observer.observe(cue, { attributes: true, attributeFilter: ['data-anchored'] });
    return () => observer.disconnect();
  }, [scrollToTarget]);

  return (
    <a
      ref={cueRef}
      className={className}
      href={`#${targetId}`}
      aria-label={accessibleLabel}
      onClick={handleClick}
    >
      <span>{label}</span>
      <svg
        className="ds-memorial-edition__scroll-cue-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4v16" />
        <path d="M6 14l6 6 6-6" />
      </svg>
    </a>
  );
}

/**
 * Public site navigation — the floating ink island. One detached pill,
 * fixed near the top edge, identical on every surface and in both themes
 * (the island is a brand-fixed ink object, like the map plate and footer;
 * see shell.css "The island"). No full-width bar, no onmap variant.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@blap/ui';
import { isNavActive, OVERFLOW_NAV, PRIMARY_NAV } from '../lib/nav';

const DESKTOP_NAV_MQ = '(min-width: 48rem)';

function PrimaryLinks({ pathname }: { readonly pathname: string }) {
  return (
    <>
      {PRIMARY_NAV.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <li key={item.href}>
            {/* Client-side Link, never a raw anchor: a full document load would remount the
                persistent (map) layout and read as a page refresh — the shell contract is that
                moving between surfaces feels like moving through one experience. */}
            <Link
              href={item.href}
              className={active ? 'bp-shell-nav__link is-active' : 'bp-shell-nav__link'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

function OverflowLinks({ pathname }: { readonly pathname: string }) {
  return (
    <>
      {OVERFLOW_NAV.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={active ? 'bp-shell-nav__link is-active' : 'bp-shell-nav__link'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

function DesktopNav({ pathname, hidden }: { readonly pathname: string; readonly hidden: boolean }) {
  const overflowActive = OVERFLOW_NAV.some((item) => isNavActive(pathname, item.href));

  return (
    <nav
      className="bp-shell-nav bp-shell-nav--desktop"
      aria-label="Primary"
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <ul className="bp-shell-nav__list">
        <PrimaryLinks pathname={pathname} />
        <li>
          <details className="bp-shell-more">
            <summary
              className={
                overflowActive
                  ? 'bp-shell-nav__link bp-shell-more__summary is-active'
                  : 'bp-shell-nav__link bp-shell-more__summary'
              }
            >
              More
            </summary>
            <ul className="bp-shell-more__panel">
              <OverflowLinks pathname={pathname} />
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}

function DrawerNav({
  id,
  pathname,
  hidden,
}: {
  readonly id: string;
  readonly pathname: string;
  readonly hidden: boolean;
}) {
  return (
    <nav
      id={id}
      className="bp-shell-nav bp-shell-nav--drawer"
      aria-label="Primary"
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <ul className="bp-shell-nav__list">
        <PrimaryLinks pathname={pathname} />
      </ul>
      <p className="bp-shell-nav__more-label">More</p>
      <ul className="bp-shell-nav__list">
        <OverflowLinks pathname={pathname} />
      </ul>
    </nav>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || '/';
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV_MQ);
    function sync() {
      setIsDesktop(media.matches);
    }
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    // Close the mobile drawer and any open desktop "More" disclosure on navigation.
    headerRef.current?.querySelectorAll('details[open]').forEach((details) => {
      details.removeAttribute('open');
    });
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header ref={headerRef} className="bp-shell-header">
      <div className="bp-shell-header__inner">
        {/* Kit artwork only, dark variants only — the island is always ink.
            Lockup on wide viewports, standalone symbol on narrow ones. */}
        <Link className="bp-shell-wordmark" href="/" aria-label="BlackStory — home">
          <img
            className="bp-shell-wordmark__img bp-shell-wordmark__img--lockup"
            src="/brand/blackstory-lockup-dark.png"
            alt=""
            aria-hidden="true"
          />
          <img
            className="bp-shell-wordmark__img bp-shell-wordmark__img--symbol"
            src="/brand/blackstory-symbol-dark.png"
            alt=""
            aria-hidden="true"
          />
        </Link>

        <DesktopNav pathname={pathname} hidden={!isDesktop} />

        {/* Plain state-driven button, NOT a <details> wrapper: the drawer must
            render OUTSIDE the island pill — the pill's backdrop-filter makes it
            the containing block for fixed descendants, which would pin the
            bottom sheet to the pill instead of the viewport. */}
        <button
          type="button"
          className="bp-shell-menu bp-shell-menu__summary"
          aria-expanded={menuOpen}
          aria-controls="shell-nav-drawer"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>

        <div className="bp-shell-header__tools">
          <Link className="bp-shell-header__cta" href="/locate">
            Near you
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {menuOpen && !isDesktop ? (
        <>
          <div
            className="bp-shell-drawer-scrim"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <DrawerNav id="shell-nav-drawer" pathname={pathname} hidden={false} />
        </>
      ) : null}
    </header>
  );
}

/**
 * Public site header with the brand lockup, primary navigation, and theme toggle.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@blap/ui';
import { isNavActive, OVERFLOW_NAV, PRIMARY_NAV } from '../lib/nav';

const DESKTOP_NAV_MQ = '(min-width: 48rem)';

/**
 * Routes whose hero/canvas is the persistent map — the header sits over ink
 * there (`.bp-shell-header--onmap`) regardless of the reader's light/dark
 * theme. The (map) route group is expected to also stamp `data-surface="map"`
 * on a document-level wrapper once BB-098 lands its own layout; shell.css
 * styles both mechanisms so this pathname check is a working default, not a
 * competing source of truth.
 */
function isMapSurface(pathname: string): boolean {
  return pathname === '/' || pathname === '/explore' || pathname.startsWith('/explore/');
}

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
  const menuRef = useRef<HTMLDetailsElement>(null);
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

  const onMap = isMapSurface(pathname);

  return (
    <header
      ref={headerRef}
      className={onMap ? 'bp-shell-header bp-shell-header--onmap' : 'bp-shell-header'}
    >
      <div className="bp-container bp-shell-header__inner">
        {/*
          Official lockup artwork only — the symbol IS the first B, so the
          product name is never typed beside the mark. Light/dark variants are
          both rendered and swapped with CSS on [data-theme] (no JS, no
          hydration flash); the link carries the stable accessible name.
        */}
        <Link className="bp-shell-wordmark" href="/" aria-label="Blap — home">
          <span className="bp-shell-wordmark__full">
            <img
              className="bp-shell-wordmark__img bp-shell-wordmark__img--light"
              src="/brand/blap-primary-light.svg"
              alt=""
              aria-hidden="true"
            />
            <img
              className="bp-shell-wordmark__img bp-shell-wordmark__img--dark"
              src="/brand/blap-primary-dark.svg"
              alt=""
              aria-hidden="true"
            />
          </span>
          <span className="bp-shell-wordmark__mini">
            <img
              className="bp-shell-wordmark__img bp-shell-wordmark__img--light"
              src="/brand/blap-mark-compact-light.svg"
              alt=""
              aria-hidden="true"
            />
            <img
              className="bp-shell-wordmark__img bp-shell-wordmark__img--dark"
              src="/brand/blap-mark-compact-dark.svg"
              alt=""
              aria-hidden="true"
            />
          </span>
        </Link>

        <details
          ref={menuRef}
          className="bp-shell-menu"
          onToggle={(event) => setMenuOpen(event.currentTarget.open)}
        >
          <summary
            className="bp-shell-menu__summary"
            aria-expanded={menuOpen}
            aria-controls="shell-nav-drawer"
          >
            Menu
          </summary>
          <DrawerNav id="shell-nav-drawer" pathname={pathname} hidden={isDesktop || !menuOpen} />
        </details>

        <DesktopNav pathname={pathname} hidden={!isDesktop} />

        <div className="bp-shell-header__tools">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

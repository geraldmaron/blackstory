/**
 * Public site header with the brand lockup, primary navigation, and theme toggle.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@black-book/ui';
import { isNavActive, OVERFLOW_NAV, PRIMARY_NAV } from '../lib/nav';

const DESKTOP_NAV_MQ = '(min-width: 48rem)';

/**
 * Routes whose hero/canvas is the persistent map — the header sits over ink
 * there (`.bb-shell-header--onmap`) regardless of the reader's light/dark
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
            <a
              href={item.href}
              className={active ? 'bb-shell-nav__link is-active' : 'bb-shell-nav__link'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </a>
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
            <a
              href={item.href}
              className={active ? 'bb-shell-nav__link is-active' : 'bb-shell-nav__link'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </a>
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
      className="bb-shell-nav bb-shell-nav--desktop"
      aria-label="Primary"
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <ul className="bb-shell-nav__list">
        <PrimaryLinks pathname={pathname} />
        <li>
          <details className="bb-shell-more">
            <summary
              className={
                overflowActive
                  ? 'bb-shell-nav__link bb-shell-more__summary is-active'
                  : 'bb-shell-nav__link bb-shell-more__summary'
              }
            >
              More
            </summary>
            <ul className="bb-shell-more__panel">
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
      className="bb-shell-nav bb-shell-nav--drawer"
      aria-label="Primary"
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <ul className="bb-shell-nav__list">
        <PrimaryLinks pathname={pathname} />
      </ul>
      <p className="bb-shell-nav__more-label">More</p>
      <ul className="bb-shell-nav__list">
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
      className={onMap ? 'bb-shell-header bb-shell-header--onmap' : 'bb-shell-header'}
    >
      <div className="bb-container bb-shell-header__inner">
        {/*
          Official lockup artwork only — the symbol IS the first B, so the
          product name is never typed beside the mark. Light/dark variants are
          both rendered and swapped with CSS on [data-theme] (no JS, no
          hydration flash); the link carries the stable accessible name.
        */}
        <a className="bb-shell-wordmark" href="/" aria-label="Black Book — home">
          <span className="bb-shell-wordmark__full">
            <img
              className="bb-shell-wordmark__img bb-shell-wordmark__img--light"
              src="/brand/black-book-primary-light.svg"
              alt=""
              aria-hidden="true"
            />
            <img
              className="bb-shell-wordmark__img bb-shell-wordmark__img--dark"
              src="/brand/black-book-primary-dark.svg"
              alt=""
              aria-hidden="true"
            />
          </span>
          <span className="bb-shell-wordmark__mini">
            <img
              className="bb-shell-wordmark__img bb-shell-wordmark__img--light"
              src="/brand/black-book-mark-compact-light.svg"
              alt=""
              aria-hidden="true"
            />
            <img
              className="bb-shell-wordmark__img bb-shell-wordmark__img--dark"
              src="/brand/black-book-mark-compact-dark.svg"
              alt=""
              aria-hidden="true"
            />
          </span>
        </a>

        <details
          ref={menuRef}
          className="bb-shell-menu"
          onToggle={(event) => setMenuOpen(event.currentTarget.open)}
        >
          <summary
            className="bb-shell-menu__summary"
            aria-expanded={menuOpen}
            aria-controls="shell-nav-drawer"
          >
            Menu
          </summary>
          <DrawerNav id="shell-nav-drawer" pathname={pathname} hidden={isDesktop || !menuOpen} />
        </details>

        <DesktopNav pathname={pathname} hidden={!isDesktop} />

        <div className="bb-shell-header__tools">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

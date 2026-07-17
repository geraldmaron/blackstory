/**
 * Public site header with wordmark, primary navigation, and theme toggle.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@black-book/ui';
import { isNavActive, PRIMARY_NAV } from '../lib/nav';

const DESKTOP_NAV_MQ = '(min-width: 48rem)';

function NavLinks({
  id,
  className,
  hidden,
}: {
  readonly id?: string;
  readonly className: string;
  readonly hidden?: boolean;
}) {
  const pathname = usePathname() || '/';

  return (
    <nav
      id={id}
      className={className}
      aria-label="Primary"
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <ul className="bb-shell-nav__list">
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
      </ul>
    </nav>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
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
    menuRef.current?.removeAttribute('open');
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="bb-shell-header">
      <div className="bb-container bb-shell-header__inner">
        <a className="bb-shell-wordmark" href="/">
          Black Book
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
          <NavLinks
            id="shell-nav-drawer"
            className="bb-shell-nav bb-shell-nav--drawer"
            hidden={isDesktop || !menuOpen}
          />
        </details>

        <NavLinks className="bb-shell-nav bb-shell-nav--desktop" hidden={!isDesktop} />

        <div className="bb-shell-header__tools">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

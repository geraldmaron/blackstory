/**
 * Public site header with wordmark, primary navigation, and theme toggle.
 */

'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@black-book/ui';
import { PRIMARY_NAV } from '../lib/nav';

export function SiteHeader() {
  const pathname = usePathname() || '/';

  return (
    <header className="bb-shell-header">
      <div className="bb-container bb-shell-header__inner">
        <a className="bb-shell-wordmark" href="/">
          Black Book
        </a>

        <details className="bb-shell-menu">
          <summary className="bb-shell-menu__summary">Menu</summary>
          <nav className="bb-shell-nav bb-shell-nav--drawer" aria-label="Primary">
            <ul className="bb-shell-nav__list">
              {PRIMARY_NAV.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
        </details>

        <nav className="bb-shell-nav bb-shell-nav--desktop" aria-label="Primary">
          <ul className="bb-shell-nav__list">
            {PRIMARY_NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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

        <div className="bb-shell-header__tools">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

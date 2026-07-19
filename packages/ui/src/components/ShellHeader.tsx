/**
 * Shared floating ink-island navbar used by the public web app and admin console.
 * Same primary/overflow IA on both surfaces so operators can traverse without a
 * second chrome language. Callers supply resolved hrefs (relative or absolute).
 */
'use client';

import { useEffect, useRef, useState, type ReactNode, type MouseEventHandler } from 'react';
import { ThemeToggle } from './ThemeToggle.js';
import { cx } from '../utils/cx.js';

const DESKTOP_NAV_MQ = '(min-width: 48rem)';

export type ShellNavItem = {
  readonly href: string;
  readonly label: string;
};

export type ShellHeaderLinkProps = {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
  readonly 'aria-current'?: 'page';
  readonly 'aria-label'?: string;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export type ShellHeaderProps = {
  readonly pathname: string;
  readonly homeHref: string;
  readonly primaryNav: readonly ShellNavItem[];
  readonly overflowNav: readonly ShellNavItem[];
  readonly brandLockupSrc: string;
  readonly brandSymbolSrc: string;
  readonly cta?: ShellNavItem;
  /** Extra trailing tools (sign out, session email, etc.). Theme toggle always included. */
  readonly tools?: ReactNode;
  /**
   * Optional same-origin link renderer (e.g. Next.js Link). Defaults to `<a>`.
   * Cross-origin absolute hrefs should still use the default anchor.
   */
  readonly renderLink?: (props: ShellHeaderLinkProps) => ReactNode;
};

export function isShellNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);
      return isShellNavActive(pathname, url.pathname);
    }
  } catch {
    // fall through
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DefaultLink({ href, className, children, onClick, ...rest }: ShellHeaderLinkProps) {
  return (
    <a href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

function NavLink({
  item,
  pathname,
  renderLink,
}: {
  readonly item: ShellNavItem;
  readonly pathname: string;
  readonly renderLink: (props: ShellHeaderLinkProps) => ReactNode;
}) {
  const active = isShellNavActive(pathname, item.href);
  return (
    <li>
      {renderLink({
        href: item.href,
        className: cx('ds-shell-nav__link', active && 'is-active'),
        ...(active ? { 'aria-current': 'page' as const } : {}),
        children: item.label,
      })}
    </li>
  );
}

export function ShellHeader({
  pathname,
  homeHref,
  primaryNav,
  overflowNav,
  brandLockupSrc,
  brandSymbolSrc,
  cta,
  tools,
  renderLink = DefaultLink,
}: ShellHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const overflowActive = overflowNav.some((item) => isShellNavActive(pathname, item.href));

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
    headerRef.current?.querySelectorAll('details[open]').forEach((details) => {
      details.removeAttribute('open');
    });
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header ref={headerRef} className="ds-shell-header">
      <div className="ds-shell-header__inner">
        {renderLink({
          href: homeHref,
          className: 'ds-shell-wordmark',
          'aria-label': 'BlackStory — home',
          children: (
            <>
              <img
                className="ds-shell-wordmark__img ds-shell-wordmark__img--lockup"
                src={brandLockupSrc}
                alt=""
                aria-hidden="true"
              />
              <img
                className="ds-shell-wordmark__img ds-shell-wordmark__img--symbol"
                src={brandSymbolSrc}
                alt=""
                aria-hidden="true"
              />
            </>
          ),
        })}

        <nav
          className="ds-shell-nav ds-shell-nav--desktop"
          aria-label="Primary"
          {...(!isDesktop ? { 'aria-hidden': true } : {})}
        >
          <ul className="ds-shell-nav__list">
            {primaryNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} renderLink={renderLink} />
            ))}
            <li>
              <details className="ds-shell-more">
                <summary
                  className={cx(
                    'ds-shell-nav__link',
                    'ds-shell-more__summary',
                    overflowActive && 'is-active',
                  )}
                >
                  More
                </summary>
                <ul className="ds-shell-more__panel">
                  {overflowNav.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      renderLink={renderLink}
                    />
                  ))}
                </ul>
              </details>
            </li>
          </ul>
        </nav>

        <button
          type="button"
          className="ds-shell-menu ds-shell-menu__summary"
          aria-expanded={menuOpen}
          aria-controls="shell-nav-drawer"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>

        <div className="ds-shell-header__tools">
          {cta
            ? renderLink({
                href: cta.href,
                className: 'ds-shell-header__cta',
                children: cta.label,
              })
            : null}
          {tools}
          <ThemeToggle />
        </div>
      </div>

      {menuOpen && !isDesktop ? (
        <>
          <div
            className="ds-shell-drawer-scrim"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="shell-nav-drawer"
            className="ds-shell-nav ds-shell-nav--drawer"
            aria-label="Primary"
          >
            <ul className="ds-shell-nav__list">
              {primaryNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} renderLink={renderLink} />
              ))}
            </ul>
            <p className="ds-shell-nav__more-label">More</p>
            <ul className="ds-shell-nav__list">
              {overflowNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} renderLink={renderLink} />
              ))}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}

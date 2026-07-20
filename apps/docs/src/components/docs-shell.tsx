/**
 * App shell: sidebar navigation, sticky top bar, theme + search, mobile drawer.
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { DocsSearch } from '@/components/docs-search';
import { ThemeToggle } from '@/components/theme-toggle';
import type { SearchHit } from '@/lib/content';
import { withBasePath } from '@/lib/base-path';
import { PRODUCT_NAME, REPO_URL } from '@/lib/site';

export type NavLink = {
  num: string;
  title: string;
  url: string;
};

export type NavSection = {
  label: string;
  links: NavLink[];
};

type Props = {
  sections: NavSection[];
  searchIndex: SearchHit[];
  children: ReactNode;
};

function pathMatches(pathname: string, url: string): boolean {
  const normalize = (value: string) => value.replace(/\/$/, '') || '/';
  return normalize(pathname) === normalize(url);
}

export function DocsShell({ sections, searchIndex, children }: Props) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className={navOpen ? 'shell nav-open' : 'shell'}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <button
        type="button"
        className="backdrop"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <aside id="docs-sidebar" className="sidebar" aria-label="Documentation">
        <Link href="/" className="sidebar-brand" aria-label={PRODUCT_NAME}>
          <Image
            src={withBasePath('/brand/lockup-light.png')}
            alt={PRODUCT_NAME}
            width={168}
            height={36}
            className="brand-light"
            priority
            unoptimized
          />
          <Image
            src={withBasePath('/brand/lockup-dark.png')}
            alt=""
            width={168}
            height={36}
            className="brand-dark"
            aria-hidden
            priority
            unoptimized
          />
        </Link>
        <nav>
          <div className="nav-group">
            <h2>Overview</h2>
            <ol>
              <li>
                <Link href="/" aria-current={pathMatches(pathname, '/') ? 'page' : undefined}>
                  <span className="nav-num">01</span>
                  <span>Home</span>
                </Link>
              </li>
            </ol>
          </div>
          {sections.map((section) => (
            <div className="nav-group" key={section.label}>
              <h2>{section.label}</h2>
              <ol>
                {section.links.map((link) => (
                  <li key={link.url}>
                    <Link
                      href={link.url}
                      aria-current={pathMatches(pathname, link.url) ? 'page' : undefined}
                    >
                      <span className="nav-num">{link.num}</span>
                      <span>{link.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={navOpen}
            aria-controls="docs-sidebar"
            onClick={() => setNavOpen((value) => !value)}
          >
            Menu
          </button>
          <DocsSearch index={searchIndex} />
          <div className="topbar-actions">
            <ThemeToggle />
            <a
              className="icon-btn"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open GitHub repository"
            >
              Repo
            </a>
          </div>
        </header>
        <main id="main" className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

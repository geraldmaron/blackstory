/**
 * Public site navigation — thin wrapper around the shared theme-aware ShellHeader.
 * Uses Next.js Link for same-origin traversal so the persistent map shell stays mounted.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_ASSETS, OVERFLOW_NAV, PRIMARY_NAV, absolutizeShellNav } from '@repo/config';
import { ShellHeader, type ShellHeaderLinkProps } from '@repo/ui';
import { isExploreMapShell } from './explore-map-shell';
import { webAdminHref } from '../lib/sibling-origins';

function NextShellLink({ href, className, children, ...rest }: ShellHeaderLinkProps) {
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || '/';
  const adminLogin = webAdminHref('/login');
  const overflow = [
    ...OVERFLOW_NAV,
    ...(adminLogin ? [{ href: adminLogin, label: 'Admin login' } as const] : []),
  ];

  const isHome = pathname === '/';
  const isExplore = isExploreMapShell(pathname);

  return (
    <ShellHeader
      pathname={pathname}
      homeHref="/"
      primaryNav={PRIMARY_NAV}
      overflowNav={absolutizeShellNav(overflow, null)}
      brandLockup={BRAND_ASSETS.lockup}
      brandSymbol={BRAND_ASSETS.symbol}
      brandDisplay={isExplore ? 'symbol' : 'lockup'}
      ctaVariant={isHome ? 'quiet' : 'copper'}
      cta={{ href: '/locate', label: isHome ? 'Near You' : 'Near you' }}
      renderLink={NextShellLink}
    />
  );
}

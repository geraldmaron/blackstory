/**
 * Public site navigation — thin wrapper around the shared ShellHeader island.
 * Uses Next.js Link for same-origin traversal so the persistent map shell stays mounted.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OVERFLOW_NAV, PRIMARY_NAV, absolutizeShellNav } from '@repo/config';
import { ShellHeader, type ShellHeaderLinkProps } from '@repo/ui';
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

  return (
    <ShellHeader
      pathname={pathname}
      homeHref="/"
      primaryNav={PRIMARY_NAV}
      overflowNav={absolutizeShellNav(overflow, null)}
      brandLockupSrc="/brand/lockup-dark.png"
      brandSymbolSrc="/brand/symbol-dark.png"
      cta={{ href: '/locate', label: 'Near you' }}
      renderLink={NextShellLink}
    />
  );
}

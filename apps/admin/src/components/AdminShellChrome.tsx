/**
 * Admin app chrome: ops-first island navbar + page body + footer.
 * Primary nav stays on local admin routes; public-site handoffs live in overflow.
 * Signed-out Sign in lives in the shell More menu (last overflow item).
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PRIMARY_NAV, absolutizeShellNav } from '@repo/config';
import { ShellHeader } from '@repo/ui';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { adminPublicSiteHref } from '../lib/sibling-origins';
import { AdminPageFooter } from './AdminPageFooter';

const OPS_PRIMARY_NAV = [
  { href: '/', label: 'Ops' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/cases', label: 'Cases' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/stories/review', label: 'Stories' },
  { href: '/sources', label: 'Sources' },
  { href: '/releases', label: 'Releases' },
] as const;

export function AdminShellChrome({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { email, signOut, user, ready } = useAdminAuth();
  const publicOrigin = adminPublicSiteHref('/')?.replace(/\/$/, '') ?? null;
  const locateHref = adminPublicSiteHref('/locate') ?? null;

  const publicHandoffs = publicOrigin
    ? absolutizeShellNav(
        PRIMARY_NAV.map((item) => ({
          ...item,
          label: item.href === '/stories' ? 'Public stories' : `${item.label} (public)`,
        })),
        publicOrigin,
      )
    : [];

  const overflowNav = [
    { href: '/quick-add', label: 'Quick add' },
    { href: '/evidence', label: 'Attach evidence' },
    { href: '/discovery', label: 'Discovery runs' },
    { href: '/graylist', label: 'Graylist' },
    { href: '/audit', label: 'Audit' },
    { href: '/switches', label: 'Switches' },
    { href: '/console', label: 'Legacy console' },
    { href: '/citation-health', label: 'Citation health' },
    ...publicHandoffs,
    ...(locateHref ? [{ href: locateHref, label: 'Near you (public)' }] : []),
    ...(ready && !user ? [{ href: '/login', label: 'Sign in' }] : []),
  ];

  return (
    <div className="admin-shell">
      <ShellHeader
        pathname={pathname}
        homeHref="/"
        primaryNav={OPS_PRIMARY_NAV}
        overflowNav={overflowNav}
        brandLockupSrc="/brand/lockup-dark.png"
        brandSymbolSrc="/brand/symbol-dark.png"
        cta={{ href: '/inbox', label: 'Inbox' }}
        {...(ready && user
          ? {
              tools: (
                <>
                  {email ? <span className="ds-shell-header__session">{email}</span> : null}
                  <button
                    type="button"
                    className="ds-shell-header__sign-out"
                    onClick={() => {
                      void signOut().then(() => {
                        router.replace('/login');
                      });
                    }}
                  >
                    Sign out
                  </button>
                </>
              ),
            }
          : {})}
      />
      <div className="admin-shell__body">{children}</div>
      <AdminPageFooter signedIn={Boolean(user)} />
    </div>
  );
}

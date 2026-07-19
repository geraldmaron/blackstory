/**
 * Admin app chrome: shared public island navbar + page body + footer.
 * Public routes open on the web origin; admin destinations stay local.
 * Signed-out Sign in lives in the shell More menu (last overflow item).
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  OVERFLOW_NAV,
  PRIMARY_NAV,
  absolutizeShellNav,
} from '@repo/config';
import { ShellHeader } from '@repo/ui';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { adminPublicSiteHref } from '../lib/sibling-origins';
import { AdminPageFooter } from './AdminPageFooter';

export function AdminShellChrome({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { email, signOut, user, ready } = useAdminAuth();
  const publicOrigin = adminPublicSiteHref('/')?.replace(/\/$/, '') ?? null;
  const publicHome = adminPublicSiteHref('/') ?? '/';
  const locateHref = adminPublicSiteHref('/locate') ?? '/locate';

  const primaryNav = absolutizeShellNav(PRIMARY_NAV, publicOrigin);
  const overflowNav = [
    ...absolutizeShellNav(OVERFLOW_NAV, publicOrigin),
    { href: '/stories/review', label: 'Story review' },
    { href: '/quick-add', label: 'Quick add' },
    { href: '/console', label: 'Console' },
    { href: '/citation-health', label: 'Citation health' },
    ...(ready && !user ? [{ href: '/login', label: 'Sign in' }] : []),
  ];

  return (
    <div className="admin-shell">
      <ShellHeader
        pathname={pathname}
        homeHref={publicHome}
        primaryNav={primaryNav}
        overflowNav={overflowNav}
        brandLockupSrc="/brand/lockup-dark.png"
        brandSymbolSrc="/brand/symbol-dark.png"
        cta={{ href: locateHref, label: 'Near you' }}
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

/**
 * Admin app chrome: ops-first theme-aware shell navbar + page body + footer.
 *
 * The bar carries one entry point per task group (see admin-nav.ts); the command palette (⌘K)
 * is the primary navigator for everything else. Public-site handoffs live in overflow, and the
 * signed-out Sign in stays the last overflow item.
 */
'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BRAND_ASSETS, PRIMARY_NAV } from '@repo/config';
import { CommandPalette, ShellHeader, useCommandPaletteHotkey } from '@repo/ui';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { AdminPageFooter } from './AdminPageFooter';
import { adminOverflowNav, adminPaletteItems, adminPrimaryNav } from './admin-nav';

const PUBLIC_GROUP = 'Public site';

export function AdminShellChrome({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const { email, role, signOut, user, ready } = useAdminAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useCommandPaletteHotkey(openPalette);

  // `/admin` is a route inside this same app now, so these are plain internal links, not a
  // cross-origin handoff — the router handles them like any other navigation.
  const publicHandoffs = PRIMARY_NAV.map((item) => ({
    ...item,
    label: `${item.label} (public)`,
  }));

  const extras = [...publicHandoffs, { href: '/locate', label: 'Near you (public)' }];

  const overflowNav = [
    ...adminOverflowNav(extras),
    ...(ready && !user ? [{ href: '/admin/login', label: 'Sign in' }] : []),
  ];

  const paletteItems = adminPaletteItems(extras.map((item) => ({ ...item, group: PUBLIC_GROUP })));

  return (
    <div className="admin-shell">
      <ShellHeader
        pathname={pathname}
        homeHref="/admin"
        primaryNav={adminPrimaryNav()}
        overflowNav={overflowNav}
        brandLockup={BRAND_ASSETS.lockup}
        brandSymbol={BRAND_ASSETS.symbol}
        tools={
          <>
            <button
              type="button"
              className="admin-shell__palette-trigger"
              onClick={openPalette}
              aria-keyshortcuts="Meta+K Control+K"
            >
              Search<kbd className="admin-shell__palette-kbd">⌘K</kbd>
            </button>
            {ready && user ? (
              <>
                {email ? (
                  <span className="ds-shell-header__session" title={`Signed in as ${email}`}>
                    <span className="ds-shell-header__session-email">{email}</span>
                    {role ? <span className="ds-shell-header__session-role">{role}</span> : null}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="ds-shell-header__sign-out"
                  onClick={() => {
                    void signOut().then(() => {
                      router.replace('/admin/login');
                    });
                  }}
                >
                  Sign out
                </button>
              </>
            ) : null}
          </>
        }
      />
      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        label="Admin navigation"
        placeholder="Jump to a surface…"
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => router.push(item.id)}
      />
      <div className="admin-shell__body">{children}</div>
      <AdminPageFooter signedIn={Boolean(user)} />
    </div>
  );
}

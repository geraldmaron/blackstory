'use client';
/** One task vocabulary, rendered through Base Web's management navigation. */
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BRAND_ASSETS, PRIMARY_NAV } from '@repo/config';
import { CommandPalette, ThemeToggle, useCommandPaletteHotkey } from '@repo/ui';
import { Button } from 'baseui/button';
import { Navigation } from 'baseui/side-navigation';
import { Drawer } from 'baseui/drawer';
import { Menu, Search, ArrowLeft } from 'baseui/icon';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { ADMIN_HOME, ADMIN_NAV_GROUPS, adminPaletteItems } from './admin-nav';
import '../design-system/management.css';
export function AdminShellChrome({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || '/admin',
    router = useRouter();
  const { email, role, signOut, user, ready } = useAdminAuth();
  const [paletteOpen, setPaletteOpen] = useState(false),
    [navigationOpen, setNavigationOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useCommandPaletteHotkey(openPalette);
  const login = pathname.startsWith('/admin/login');
  const items = [
    { title: ADMIN_HOME.label, itemId: ADMIN_HOME.href },
    ...ADMIN_NAV_GROUPS.map((group) => ({
      title: group.label,
      subNav: group.destinations.map((item) => ({ title: item.label, itemId: item.href })),
    })),
  ];
  const extras = PRIMARY_NAV.map((item) => ({
    ...item,
    label: `${item.label} (public)`,
    group: 'Public site',
  }));
  const paletteItems = adminPaletteItems(extras);
  const navigation = (
    <nav aria-label="Management">
      <Navigation
        items={items}
        activeItemId={pathname}
        activePredicate={(item, active) =>
          !!item.itemId &&
          (item.itemId === '/admin'
            ? active === '/admin'
            : active === item.itemId || active.startsWith(`${item.itemId}/`))
        }
        onChange={({ item, event }) => {
          if (
            'metaKey' in event &&
            (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          )
            return;
          event.preventDefault();
          if (item.itemId) {
            router.push(item.itemId);
            setNavigationOpen(false);
          }
        }}
        overrides={{
          Root: { style: { backgroundColor: 'transparent' } },
          NavLink: { style: { borderRadius: '8px', marginBottom: '1px' } },
          NavItem: {
            style: ({ $active, $selectable }: { $active: boolean; $selectable: boolean }) => ({
              fontSize: '13px',
              lineHeight: '20px',
              minHeight: $selectable ? '34px' : '24px',
              paddingTop: '6px',
              paddingBottom: '6px',
              color: $active ? 'var(--ds-accent)' : 'var(--ds-ink)',
              backgroundColor: $active ? 'var(--ds-surface)' : 'transparent',
              borderLeftColor: $active ? 'var(--ds-accent)' : 'transparent',
              fontWeight: $active ? 600 : 400,
            }),
          },
        }}
      />
    </nav>
  );
  const brand = (
    <Link href="/admin" className="admin-base-brand" aria-label="BlackStory administration">
      <Image
        className="admin-base-brand__light"
        src={BRAND_ASSETS.lockup.light}
        alt="BlackStory"
        unoptimized
        loading="eager"
        width={800}
        height={450}
        style={{ width: 174, height: 'auto' }}
      />
      <Image
        className="admin-base-brand__dark"
        src={BRAND_ASSETS.lockup.dark}
        alt="BlackStory"
        unoptimized
        loading="eager"
        width={800}
        height={450}
        style={{ width: 174, height: 'auto' }}
      />
    </Link>
  );
  return (
    <div className={`admin-base-shell${login ? ' admin-base-shell--login' : ''}`}>
      {!login && (
        <aside className="admin-base-sidebar">
          {brand}
          <p className="admin-base-workspace">Editorial workspace</p>
          {navigation}
          <div className="admin-base-sidebar__foot">
            <Link href="/stories">Open public site</Link>
            <p>History, pinned to place.</p>
          </div>
        </aside>
      )}
      <div className="admin-base-main">
        <header className="admin-base-topbar">
          {!login && (
            <div className="admin-base-mobile-menu">
              <Button
                kind="tertiary"
                aria-label="Open management navigation"
                onClick={() => setNavigationOpen(true)}
              >
                <Menu size={22} />
              </Button>
            </div>
          )}
          {login ? (
            brand
          ) : (
            <>
              <span className="admin-base-topbar__context">Management</span>
              <Button
                kind="tertiary"
                size="compact"
                onClick={openPalette}
                startEnhancer={<Search size={18} />}
                aria-keyshortcuts="Meta+K Control+K"
              >
                Search <kbd>⌘K</kbd>
              </Button>
            </>
          )}
          <div className="admin-base-topbar__account">
            <ThemeToggle />
            {ready && user && (
              <>
                <span className="admin-base-session" title={email ?? undefined}>
                  {role ?? 'Staff'}
                </span>
                <Button
                  kind="tertiary"
                  size="compact"
                  onClick={() => void signOut().then(() => router.replace('/admin/login'))}
                >
                  Sign out
                </Button>
              </>
            )}
            {!login && (
              <Button
                kind="tertiary"
                size="compact"
                href="/stories"
                startEnhancer={<ArrowLeft size={16} />}
              >
                Public site
              </Button>
            )}
          </div>
        </header>
        <div className="admin-base-content">{children}</div>
        <footer className="admin-base-footer">
          <span>BlackStory administration</span>
          <Link href="/methodology">Evidence and methodology</Link>
        </footer>
      </div>
      <Drawer
        isOpen={navigationOpen}
        onClose={() => setNavigationOpen(false)}
        anchor="left"
        size="300px"
        animate={false}
        overrides={{
          DrawerContainer: {
            props: { role: 'dialog', 'aria-modal': true, 'aria-label': 'Management navigation' },
          },
          DrawerBody: {
            style: {
              marginTop: '24px',
              marginBottom: '24px',
              marginLeft: '16px',
              marginRight: '16px',
            },
          },
        }}
      >
        {brand}
        {navigation}
      </Drawer>
      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        label="Management navigation"
        placeholder="Find articles, records or a management page"
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => router.push(item.id)}
      />
    </div>
  );
}

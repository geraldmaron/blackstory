/**
 * Nested layout for the staff administration console (`/admin/**`).
 *
 * The document shell (`<html>`/`<body>`, theme-bootstrap script, `--ds-font-*` variables,
 * `@repo/ui/styles.css`) comes from the app's root layout — admin shares it rather than
 * re-declaring it, since `/admin` now lives inside this Next.js app instead of a separate one.
 * `surface-classes.ts` keeps the public `SiteShellHeader`/`SiteShellFooter` off every `/admin`
 * path, so `AdminShellChrome` below is the only chrome `/admin` pages render.
 */
import type { ReactNode } from 'react';
import { AdminDesignProvider } from '@/admin/design-system/provider';
import { AdminAuthProvider } from '../../admin/auth/AdminAuthProvider';
import { readVerifiedAdminIdentity } from '../../admin/auth/supabase-server';
import { AdminShellChrome } from '../../admin/components/AdminShellChrome';
import './admin.css';

export const metadata = {
  title: {
    default: 'BlackStory Admin',
    template: '%s — BlackStory Admin',
  },
  description: 'Private administration and research console',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Cached per request, so the pages and nested layouts that also ask share this one check.
  const identity = await readVerifiedAdminIdentity();
  return (
    <AdminDesignProvider>
      <AdminAuthProvider initialRole={identity?.role ?? null}>
        <AdminShellChrome>{children}</AdminShellChrome>
      </AdminAuthProvider>
    </AdminDesignProvider>
  );
}

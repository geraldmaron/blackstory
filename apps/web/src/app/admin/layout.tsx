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
import { AdminAuthProvider } from '../../admin/auth/AdminAuthProvider';
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

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShellChrome>{children}</AdminShellChrome>
    </AdminAuthProvider>
  );
}

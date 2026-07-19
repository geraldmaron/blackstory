/**
 * Client gate: requires a Firebase Auth session; otherwise redirects to /login.
 */
'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../auth/AdminAuthProvider';

export function RequireAdminAuth({ children }: { readonly children: ReactNode }) {
  const { ready, user } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [ready, user, router, pathname]);

  if (!ready) {
    return (
      <div className="admin-gate" role="status">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-gate" role="status">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}

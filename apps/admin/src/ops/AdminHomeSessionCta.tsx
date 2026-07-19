/**
 * Client session CTA for the admin home dashboard — sign-in when signed out.
 */
'use client';

import Link from 'next/link';
import { useAdminAuth } from '../auth/AdminAuthProvider';

export function AdminHomeSessionCta() {
  const { ready, user } = useAdminAuth();

  if (!ready) {
    return (
      <p className="admin-ops__session-status" role="status">
        Checking session…
      </p>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="admin-ops__actions">
      <Link className="ds-button ds-button--primary" href="/login">
        Sign in
      </Link>
    </div>
  );
}

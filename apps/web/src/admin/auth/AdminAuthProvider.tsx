/**
 * Client auth context: signed-in administrator session, loading state, and helpers.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAdminIdToken,
  signInAdminWithEmailPassword,
  signOutAdmin,
  subscribeAdminAuth,
} from './client-auth';
import type { AdminSessionUser } from './session-user';
import type { StaffRole } from './staff-permissions';

export type AdminAuthContextValue = {
  readonly ready: boolean;
  readonly user: AdminSessionUser | null;
  readonly email: string | null;
  /** Server-verified staff role; null until /api/auth/me confirms it. */
  readonly role: StaffRole | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({
  children,
  initialRole = null,
}: {
  readonly children: ReactNode;
  /**
   * The role the server already verified while rendering the layout. When present the client
   * skips its own `/admin/api/auth/me` round trip, which otherwise sits between first paint and
   * every role-gated control (and made the role label flip after load).
   */
  readonly initialRole?: StaffRole | null;
}) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [role, setRole] = useState<StaffRole | null>(initialRole);

  // The role is only trustworthy from the server, which reads app_metadata.app_role off a
  // verified token. Never read it from the client session object, which the browser holds.
  useEffect(() => {
    let canceled = false;
    // Server-verified at render: nothing to fetch. Signing out navigates away, so the stale value
    // never outlives the session it described.
    if (initialRole) return;
    if (!user) {
      setRole(null);
      return;
    }
    void (async () => {
      const token = await getAdminIdToken();
      if (!token || canceled) return;
      const response = await fetch('/admin/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (canceled || !response?.ok) return;
      const body = (await response.json().catch(() => null)) as { role?: StaffRole } | null;
      if (!canceled) setRole(body?.role ?? null);
    })();
    return () => {
      canceled = true;
    };
  }, [user, initialRole]);

  useEffect(() => {
    let canceled = false;
    const unsubscribe = subscribeAdminAuth((next) => {
      if (canceled) return;
      if (next && !next.email) {
        void signOutAdmin().then(() => {
          if (!canceled) {
            setUser(null);
            setReady(true);
          }
        });
        return;
      }
      setUser(next);
      setReady(true);
    });

    return () => {
      canceled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInAdminWithEmailPassword(email, password);
  }, []);

  // Clear local state even when the server call fails; otherwise an offline sign-out leaves
  // the login form disabled behind a session nobody can use.
  const signOut = useCallback(async () => {
    try {
      await signOutAdmin();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      ready,
      user,
      email: user?.email ?? null,
      role,
      signIn,
      signOut,
      getIdToken: getAdminIdToken,
    }),
    [ready, user, role, signIn, signOut],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}

export type { AdminSessionUser } from './session-user';

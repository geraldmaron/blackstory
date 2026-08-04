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
import type { StaffRole } from './role-mutation';

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

export function AdminAuthProvider({ children }: { readonly children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);

  // The role is only trustworthy from the server, which reads app_metadata.bb_role off a
  // verified token. Never read it from the client session object, which the browser holds.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      return;
    }
    void (async () => {
      const token = await getAdminIdToken();
      if (!token || cancelled) return;
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (cancelled || !response?.ok) return;
      const body = (await response.json().catch(() => null)) as { role?: StaffRole } | null;
      if (!cancelled) setRole(body?.role ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeAdminAuth((next) => {
      if (cancelled) return;
      if (next && !next.email) {
        void signOutAdmin().then(() => {
          if (!cancelled) {
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
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInAdminWithEmailPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutAdmin();
    setUser(null);
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

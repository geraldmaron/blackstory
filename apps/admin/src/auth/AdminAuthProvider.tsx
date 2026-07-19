/**
 * Client auth context: signed-in Firebase Auth user, loading state, and helpers.
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
import type { User } from 'firebase/auth';
import {
  getAdminIdToken,
  signInAdminWithEmailPassword,
  signOutAdmin,
  subscribeAdminAuth,
} from '../auth/client-auth';

export type AdminAuthContextValue = {
  readonly ready: boolean;
  readonly user: User | null;
  readonly email: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { readonly children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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
      signIn,
      signOut,
      getIdToken: getAdminIdToken,
    }),
    [ready, user, signIn, signOut],
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

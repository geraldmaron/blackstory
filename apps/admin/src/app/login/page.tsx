/**
 * `/login` — branded email/password sign-in for the private admin console.
 */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="admin-login" id="main">
          <div className="admin-login__panel">
            <p className="admin-login__meta">Loading sign-in…</p>
          </div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}

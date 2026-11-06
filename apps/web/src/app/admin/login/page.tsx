/**
 * `/admin/login` — branded email/password sign-in for the private admin console.
 */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginClient from './LoginClient';
import { LoginFallback } from './login-panel';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}

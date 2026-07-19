/**
 * Client login UI — email + password for Firebase Authentication operators.
 * Shell navbar/footer come from the root AdminShellChrome.
 */
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../auth/AdminAuthProvider';

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return '/stories/review';
  }
  return raw;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, user, signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams],
  );

  useEffect(() => {
    if (ready && user) {
      router.replace(nextPath);
    }
  }, [ready, user, router, nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace(nextPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="admin-login" id="main">
      <section className="admin-login__panel" aria-labelledby="admin-login-title">
        <p className="admin-login__eyebrow">Administration</p>
        <h1 className="admin-login__title" id="admin-login-title">
          Sign in
        </h1>
        <p className="admin-login__lede">
          History, pinned to place — private console for research and story review.
        </p>
        <p className="admin-login__meta">
          Use an administrator account provisioned in Firebase Authentication. There is no
          public sign-up on this portal.
        </p>

        {error ? (
          <p className="admin-login__alert" role="alert">
            {error}
          </p>
        ) : null}

        <form className="admin-login__form" onSubmit={onSubmit} noValidate>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              className="admin-login__input"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy || !ready || Boolean(user)}
            />
          </div>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="admin-login__input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy || !ready || Boolean(user)}
            />
          </div>
          <div className="admin-login__actions">
            <button
              type="submit"
              className="ds-button ds-button--primary"
              disabled={busy || !ready || Boolean(user) || !email || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

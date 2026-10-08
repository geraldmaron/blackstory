/**
 * Client login UI — email + password for Supabase Auth operators.
 * After auth, operators land on the operations desk (`/`) unless `?next=` is a
 * safe same-origin path (e.g. the page that bounced them to login).
 * Shell navbar/footer come from the root AdminShellChrome.
 */
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../admin/auth/AdminAuthProvider';
import {
  ADMIN_NETWORK_FAILURE_MESSAGE,
  isNetworkFailureMessage,
} from '../../../admin/auth/network-error';
import { safeAdminNextPath } from './safe-admin-next-path';

const NOT_PROVISIONED =
  'This account is not provisioned for admin access. Ask an administrator to set a staff role on it.';

function loginErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return isNetworkFailureMessage(message) ? ADMIN_NETWORK_FAILURE_MESSAGE : message;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, user, signIn, signOut, getIdToken } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The fields are live in the server HTML, so an operator can type before hydration. React
  // leaves that text in the DOM but not in state, and the next render would reset it; adopt it
  // once, before anything re-renders.
  useLayoutEffect(() => {
    const typedEmail = emailRef.current?.value;
    const typedPassword = passwordRef.current?.value;
    if (typedEmail) setEmail(typedEmail);
    if (typedPassword) setPassword(typedPassword);
  }, []);

  const nextPath = useMemo(() => safeAdminNextPath(searchParams.get('next')), [searchParams]);

  /**
   * A Supabase session alone is not admin access — the gates require a staff role in
   * app_metadata.app_role. Confirm it here, otherwise redirecting would bounce straight
   * back off the middleware and loop. router.refresh() drops the cached RSC payload so
   * the destination re-renders on the server with the new session cookie.
   */
  const enterConsole = useCallback(async () => {
    let response: Response | null;
    try {
      const token = await getIdToken();
      response = token
        ? await fetch('/admin/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        : null;
    } catch (err: unknown) {
      // Unverified is not admin: drop the session so the form re-enables for another attempt.
      await signOut().catch(() => undefined);
      setError(loginErrorMessage(err));
      setBusy(false);
      return;
    }
    if (!response?.ok) {
      await signOut().catch(() => undefined);
      setError(NOT_PROVISIONED);
      setBusy(false);
      return;
    }
    router.refresh();
    router.replace(nextPath);
  }, [getIdToken, signOut, router, nextPath]);

  useEffect(() => {
    if (ready && user) {
      void enterConsole();
    }
  }, [ready, user, enterConsole]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      await enterConsole();
    } catch (err: unknown) {
      setError(loginErrorMessage(err));
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
          Use your staff account to review research and manage releases.
        </p>

        {error ? (
          <p className="admin-login__alert" role="alert">
            {error}
          </p>
        ) : null}

        {/* POST, never the default GET: if a native submit ever fires before hydration, the
            password goes in a request body to this origin, not into a URL, history or logs. */}
        <form className="admin-login__form" method="post" onSubmit={onSubmit} noValidate>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              ref={emailRef}
              className="admin-login__input"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy || Boolean(user)}
            />
          </div>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              ref={passwordRef}
              className="admin-login__input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy || Boolean(user)}
            />
          </div>
          <div className="admin-login__actions">
            {/* Gated on `ready` as well: the fields are live before the auth client is, but a
                sign-in cannot run until it is. */}
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

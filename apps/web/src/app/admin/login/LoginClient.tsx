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
import { useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../admin/auth/AdminAuthProvider';
import {
  ADMIN_NETWORK_FAILURE_MESSAGE,
  isNetworkFailureMessage,
} from '../../../admin/auth/network-error';
import { LoginPanel } from './login-panel';
import { safeAdminNextPath } from './safe-admin-next-path';

const NOT_PROVISIONED =
  'This account is not provisioned for admin access. Ask an administrator to set a staff role on it.';
const NOT_CONFIRMED = 'Could not confirm your staff access. Please try again in a moment.';

function loginErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return isNetworkFailureMessage(message) ? ADMIN_NETWORK_FAILURE_MESSAGE : message;
}

export default function LoginClient() {
  const searchParams = useSearchParams();
  const { ready, user, signIn, signOut, getIdToken } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null!);
  const passwordRef = useRef<HTMLInputElement>(null!);

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
   * back off the middleware and loop. The destination is a full page load, so it renders on the
   * server with the new session cookie: a soft router.refresh() plus router.replace() raced each
   * other (each aborted the other) and left the page stuck on "Checking your staff access".
   */
  const entering = useRef(false);
  const enterConsole = useCallback(async () => {
    // Session events re-run the effect below; one check and one navigation is enough.
    if (entering.current) return;
    entering.current = true;
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
      entering.current = false;
      return;
    }
    if (!response?.ok) {
      await signOut().catch(() => undefined);
      // Only a 403 means the role is missing; an expired token or a server fault is not that.
      setError(response?.status === 403 ? NOT_PROVISIONED : NOT_CONFIRMED);
      setBusy(false);
      entering.current = false;
      return;
    }
    window.location.assign(nextPath);
  }, [getIdToken, signOut, nextPath]);

  useEffect(() => {
    if (ready && user) {
      void enterConsole();
    }
  }, [ready, user, enterConsole]);

  // The fields are disabled while a sign-in runs, which drops focus to the page; put it back.
  useEffect(() => {
    if (error) passwordRef.current?.focus();
  }, [error]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Signing in sets `user`, and the effect above then verifies staff access once.
      await signIn(email, password);
    } catch (err: unknown) {
      setError(loginErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <LoginPanel
      email={email}
      password={password}
      error={error}
      busy={busy}
      ready={ready}
      signedIn={Boolean(user)}
      emailRef={emailRef}
      passwordRef={passwordRef}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
    />
  );
}

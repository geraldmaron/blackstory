/**
 * Presentation of the staff sign-in panel. It holds no auth state, calls no auth client and owns no
 * handler: `LoginClient` supplies the values and callbacks, so every state (idle, auth not ready,
 * signing in, verifying an existing session, failed) can be rendered from plain props.
 */
'use client';

import React, { type FormEventHandler, type RefObject } from 'react';
import { Input } from 'baseui/input';
import { Button } from 'baseui/button';

void React;

export const LOGIN_ERROR_ID = 'admin-login-error';
export const LOGIN_STATUS_ID = 'admin-login-status';

/** The one polite line that explains why the form is not ready to submit, or null when it is. */
export function loginStatusMessage({
  ready,
  busy,
  signedIn,
  error,
}: {
  readonly ready: boolean;
  readonly busy: boolean;
  readonly signedIn: boolean;
  readonly error: string | null;
}): string | null {
  if (error) return null;
  if (signedIn) return 'Checking your staff access…';
  if (busy) return 'Signing in…';
  if (!ready) return 'Preparing sign-in…';
  return null;
}

/** Announced once and marked busy, so the wait for the sign-in form is not silent. */
export function LoginFallback() {
  return (
    <main className="admin-login" id="main" aria-busy="true">
      <div className="admin-login__panel">
        <p className="admin-login__status" role="status">
          Loading sign-in…
        </p>
      </div>
    </main>
  );
}

export function LoginPanel({
  email,
  password,
  error,
  busy,
  ready,
  signedIn,
  emailRef,
  passwordRef,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  readonly email: string;
  readonly password: string;
  readonly error: string | null;
  readonly busy: boolean;
  readonly ready: boolean;
  readonly signedIn: boolean;
  readonly emailRef: RefObject<HTMLInputElement>;
  readonly passwordRef: RefObject<HTMLInputElement>;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const status = loginStatusMessage({ ready, busy, signedIn, error });
  const linked = error
    ? { 'aria-describedby': LOGIN_ERROR_ID, 'aria-invalid': true as const }
    : {};
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
          <p className="admin-login__alert" id={LOGIN_ERROR_ID} role="alert">
            {error}
          </p>
        ) : null}

        {/* POST, never the default GET: if a native submit ever fires before hydration, the
            password goes in a request body to this origin, not into a URL, history or logs. */}
        <form
          className="admin-login__form"
          method="post"
          onSubmit={onSubmit}
          noValidate
          aria-busy={busy || signedIn}
        >
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-email">
              Email
            </label>
            <Input
              id="admin-email"
              inputRef={emailRef}
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              disabled={busy || signedIn}
              overrides={{ Input: { props: linked } }}
            />
          </div>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="admin-password">
              Password
            </label>
            <Input
              id="admin-password"
              inputRef={passwordRef}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              overrides={{ Input: { props: { minLength: 8, ...linked } } }}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              disabled={busy || signedIn}
            />
          </div>
          <div className="admin-login__actions">
            {/* Always mounted so the live region exists before its text changes. */}
            <p className="admin-login__status" id={LOGIN_STATUS_ID} role="status">
              {status}
            </p>
            {/* Gated on `ready` as well: the fields are live before the auth client is, but a
                sign-in cannot run until it is. */}
            <Button
              type="submit"
              disabled={busy || !ready || signedIn || !email || !password}
              overrides={{ BaseButton: { props: { 'aria-describedby': LOGIN_STATUS_ID } } }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

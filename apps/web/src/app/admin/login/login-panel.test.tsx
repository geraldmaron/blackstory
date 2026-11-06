/**
 * Every sign-in state rendered from synthetic props. Nothing here touches the auth client, a session
 * or a network; it proves the presentation of idle, not-ready, busy, verifying and failed states,
 * not that a real operator can sign in.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import React, { type RefObject } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminDesignProvider } from '../../../admin/design-system/provider';
import { LoginFallback, LoginPanel, loginStatusMessage } from './login-panel';

void React;

const ref = { current: null } as unknown as RefObject<HTMLInputElement>;

type State = Partial<React.ComponentProps<typeof LoginPanel>>;

function render(state: State = {}): string {
  return renderToStaticMarkup(
    <AdminDesignProvider>
      <LoginPanel
        email="staff@example.test"
        password="correct horse"
        error={null}
        busy={false}
        ready
        signedIn={false}
        emailRef={ref}
        passwordRef={ref}
        onEmailChange={() => {}}
        onPasswordChange={() => {}}
        onSubmit={() => {}}
        {...state}
      />
    </AdminDesignProvider>,
  );
}

function submitButton(html: string): string {
  const match = html.match(/<button[^>]*type="submit"[^>]*>/);
  assert.ok(match, 'sign-in button is rendered');
  return match[0];
}

test('idle: a ready form posts, has a named heading and an empty live status', () => {
  const html = render();
  assert.match(html, /<form[^>]*method="post"/);
  assert.match(html, /aria-labelledby="admin-login-title"/);
  assert.match(html, /<h1[^>]*id="admin-login-title"[^>]*>Sign in<\/h1>/);
  assert.match(html, /<label[^>]*for="admin-email"[^>]*>Email<\/label>/);
  assert.match(html, /<label[^>]*for="admin-password"[^>]*>Password<\/label>/);
  assert.match(html, /<p class="admin-login__status" id="admin-login-status" role="status"><\/p>/);
  assert.doesNotMatch(submitButton(html), /disabled/);
  assert.doesNotMatch(html, /role="alert"|aria-invalid="true"|admin-login-error/);
});

test('auth not ready: sign-in is disabled and says why', () => {
  const html = render({ ready: false });
  assert.match(html, />Preparing sign-in…<\/p>/);
  assert.match(submitButton(html), /disabled/);
  assert.match(submitButton(html), /aria-describedby="admin-login-status"/);
});

test('empty fields keep sign-in disabled without a misleading status', () => {
  const html = render({ email: '', password: '' });
  assert.match(submitButton(html), /disabled/);
  assert.match(html, /<p class="admin-login__status"[^>]*><\/p>/);
});

test('busy: fields and button are disabled, the form is busy, status and label agree', () => {
  const html = render({ busy: true });
  assert.match(html, /<form[^>]*aria-busy="true"/);
  assert.match(html, /role="status">Signing in…<\/p>/);
  assert.match(submitButton(html), /disabled/);
  assert.equal((html.match(/<input[^>]*disabled/g) ?? []).length, 2);
});

test('verifying an existing session: locked and announced, never shown as an error', () => {
  const html = render({ signedIn: true });
  assert.match(html, /Checking your staff access…/);
  assert.match(submitButton(html), /disabled/);
  assert.doesNotMatch(html, /role="alert"/);
});

test('failed: one alert, linked to both fields, form re-enabled, no competing status text', () => {
  const html = render({ error: 'This account is not provisioned for admin access.' });
  assert.equal((html.match(/role="alert"/g) ?? []).length, 1);
  assert.match(html, /id="admin-login-error"[^>]*role="alert"/);
  assert.equal((html.match(/aria-describedby="admin-login-error"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 2);
  assert.doesNotMatch(submitButton(html), /disabled/);
  assert.match(html, /<p class="admin-login__status"[^>]*><\/p>/);
});

test('the password never appears in rendered markup attributes other than the controlled value', () => {
  const html = render({ password: 'correct horse' });
  assert.match(html, /<input[^>]*type="password"/);
  assert.doesNotMatch(html, /href="[^"]*correct horse/);
});

test('status precedence is stable', () => {
  const base = { ready: true, busy: false, signedIn: false, error: null };
  assert.equal(loginStatusMessage(base), null);
  assert.equal(loginStatusMessage({ ...base, ready: false }), 'Preparing sign-in…');
  assert.equal(loginStatusMessage({ ...base, busy: true }), 'Signing in…');
  assert.equal(loginStatusMessage({ ...base, signedIn: true }), 'Checking your staff access…');
  assert.equal(loginStatusMessage({ ...base, busy: true, error: 'Nope' }), null);
});

test('the suspense fallback is busy and announced exactly once', () => {
  const html = renderToStaticMarkup(<LoginFallback />);
  assert.match(html, /<main[^>]*id="main"[^>]*aria-busy="true"/);
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.match(html, /Loading sign-in…/);
});

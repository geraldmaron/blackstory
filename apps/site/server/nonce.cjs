/**
 * Per-request CSP nonce helpers for the site server entry. Pure functions so they are unit tested
 * without a running server. This is the Expo-side replacement for the nonce handling in
 * apps/web/src/proxy.ts.
 */
const { randomBytes } = require('node:crypto');

function makeNonce() {
  return randomBytes(16).toString('base64');
}

/** Adds the nonce to every script, style and script preload that does not already carry one. */
function addNonce(html, nonce) {
  return html
    .replace(/<(script|style)\b(?![^>]*\bnonce=)/g, `<$1 nonce="${nonce}"`)
    .replace(/<link\b(?![^>]*\bnonce=)(?=[^>]*\bas="script")/g, `<link nonce="${nonce}"`);
}

/**
 * The policy shape the Next site ships today (script-src 'self' + nonce + strict-dynamic). Style and
 * the rest of the directive list move over with the proxy.ts port (repo-doplj).
 */
function cspHeader(nonce) {
  return `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`;
}

module.exports = { makeNonce, addNonce, cspHeader };

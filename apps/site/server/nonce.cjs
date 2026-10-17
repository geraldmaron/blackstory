/**
 * Per-request CSP nonce helpers for the site server entry. Pure functions so they are unit tested
 * without a running server. This is the Expo-side replacement for the nonce handling in
 * apps/web/src/proxy.ts.
 *
 * Next hands the renderer a nonce, so only framework scripts carry it. Here the document is
 * finished before the nonce is added, so adding it to every script would also bless any script an
 * injection put in the markup. `addNonce` therefore only marks what Expo's renderer emits: scripts
 * and preloads served from `/_expo/static/`, at most one inline hydration bootstrap (`id="_R_"`)
 * and at most one inline module hydrate flag, and styles (style-src already allows inline).
 */
const { randomBytes } = require('node:crypto');

function makeNonce() {
  return randomBytes(16).toString('base64');
}

const STATIC_SRC = /\bsrc="\/_expo\/static\/[^"]*"/;
const STATIC_HREF = /\bhref="\/_expo\/static\/[^"]*"/;

function addNonce(html, nonce) {
  let bootstrap = 0;
  let moduleFlag = 0;
  return html
    .replace(/<script\b([^>]*)>/g, (tag, attrs) => {
      if (/\bnonce=/.test(attrs)) return tag;
      const trusted =
        (STATIC_SRC.test(attrs) && !/\btype=/.test(attrs.replace(/\btype="module"/, ''))) ||
        (/\bid="_R_"/.test(attrs) && !/\bsrc=/.test(attrs) && ++bootstrap === 1) ||
        (/\btype="module"/.test(attrs) && !/\bsrc=/.test(attrs) && ++moduleFlag === 1);
      return trusted ? `<script nonce="${nonce}"${attrs}>` : tag;
    })
    .replace(/<style\b(?![^>]*\bnonce=)/g, `<style nonce="${nonce}"`)
    .replace(/<link\b([^>]*)>/g, (tag, attrs) =>
      !/\bnonce=/.test(attrs) && /\bas="script"/.test(attrs) && STATIC_HREF.test(attrs)
        ? `<link nonce="${nonce}"${attrs}>`
        : tag,
    );
}

module.exports = { makeNonce, addNonce };

/**
 * The maintenance page itself: one self-contained HTML string, rendered at the edge.
 *
 * Everything is inline. No stylesheet request, no script, no font request, no analytics beacon,
 * no favicon fetch beyond the one the browser makes anyway. The single external reference is the
 * brand lockup in `/public/brand`, which Vercel serves from static storage and never boots a
 * function for. That is the whole cost model: an edge invocation and a static image.
 *
 * Type is a system stack rather than the brand faces. `next/font` self-hosts Schibsted Grotesk
 * and Newsreader under a build-hashed `/_next/static/media` path that this module cannot know,
 * and `font-src` is `'self'`, so Google Fonts is not an option either. The stacks below aim at
 * the same shapes — a neutral grotesk for the headline, a transitional serif for the body — and
 * accept that the page is close to the brand rather than exactly it.
 *
 * Lockup sizing is deliberate and lives here rather than in a CSS comment, because every byte
 * of that comment would ship to every visitor. The art is an 800x450 canvas carrying a 599x169
 * mark, so the visible wordmark is ~0.75 of the rendered box: the 18rem box below puts it at
 * ~216px, clear of brand.md's 168px digital minimum. That minimum applies in full here — this is
 * standalone placement, not the compact nav exception documented in `shell-header.css`. The
 * negative margins cancel the art's own transparent inset (~14% left, ~30% top) so the wordmark
 * aligns optically with the headline instead of floating inside its own padding.
 *
 * The lockup uses `<picture>` rather than two `<img>` tags toggled by CSS. `display: none` does
 * not stop a download: the CSS approach fetched both the light and the dark art on every view,
 * 136 KB where 80 KB was needed, on the one page whose entire justification is cost.
 *
 * Colours are the brand tokens verbatim (brand/tokens/colors.json), duplicated as literals
 * because `@repo/ui`'s stylesheet is a CSS import that has no meaning inside an edge string.
 */

import { BRAND_ASSETS, PRODUCT_NAME } from '@repo/config';

export interface MaintenancePageOptions {
  /** Operator override for the body copy. Escaped before it reaches the document. */
  readonly message?: string;
  /** Advertised in the visible status line as well as the `Retry-After` header. */
  readonly retryAfterSeconds: number;
}

const DEFAULT_MESSAGE =
  'BlackStory is offline while we rework how the archive stores and serves its records. ' +
  'Nothing has been lost. The records, the sources, and the corrections queue are all intact — ' +
  'what is changing is the plumbing underneath them.';

/** Render the complete maintenance document. */
export function renderMaintenancePage(options: MaintenancePageOptions): string {
  const message = escapeHtml(options.message ?? DEFAULT_MESSAGE);
  const title = escapeHtml(`${PRODUCT_NAME} — under maintenance`);
  const lockupLight = escapeHtml(BRAND_ASSETS.lockup.light);
  const lockupDark = escapeHtml(BRAND_ASSETS.lockup.dark);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4EFE5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)">
<title>${title}</title>
<style>
:root {
  --ink: #0A0A0A;
  --paper: #F4EFE5;
  --surface: #FBF8F2;
  --copper: #8E4F2A;
  --stone: #6D675F;
  --rule: #D7D0C4;
  --sans: "Schibsted Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --serif: Newsreader, ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #F4EFE5;
    --paper: #0A0A0A;
    --surface: #161616;
    --copper: #D07A32;
    --stone: #948D83;
    --rule: #2A2724;
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--serif);
  -webkit-font-smoothing: antialiased;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}
main {
  width: 100%;
  max-width: 34rem;
  text-align: left;
}
.lockup {
  display: block;
  width: min(18rem, 100%);
  height: auto;
  margin: -3rem 0 0.5rem -2.6rem;
}
h1 {
  font-family: var(--sans);
  font-weight: 600;
  font-size: clamp(1.75rem, 1.2rem + 2.2vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0 0 1.25rem;
  text-wrap: balance;
}
p {
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--stone);
  margin: 0 0 1.25rem;
}
.return {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 1rem;
  color: var(--copper);
  margin: 0;
}
hr {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: 2.5rem 0 1rem;
}
.status {
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--stone);
  margin: 0;
}
@media (prefers-reduced-motion: no-preference) {
  main { animation: rise 420ms ease-out both; }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: none; }
}
</style>
</head>
<body>
<main>
  <picture>
    <source srcset="${lockupDark}" media="(prefers-color-scheme: dark)">
    <img class="lockup" src="${lockupLight}" alt="${escapeHtml(PRODUCT_NAME)}" width="800" height="450">
  </picture>
  <h1>The archive is closed for maintenance.</h1>
  <p>${message}</p>
  <p class="return">We will be back. Check again ${escapeHtml(describeRetryWindow(options.retryAfterSeconds))}.</p>
  <hr>
  <p class="status">HTTP 503 · SERVICE TEMPORARILY UNAVAILABLE</p>
</main>
</body>
</html>`;
}

/**
 * Turn `Retry-After` into a phrase a reader can act on.
 *
 * Deliberately vague at the top end. A countdown to a specific hour is a promise the archive
 * cannot keep during an open-ended data migration, and a missed countdown reads worse than no
 * countdown at all.
 */
export function describeRetryWindow(seconds: number): string {
  if (seconds <= 60 * 60) {
    return 'within the hour';
  }
  if (seconds <= 60 * 60 * 24) {
    return 'later today';
  }
  return 'in a few days';
}

/** Escape the five characters that matter inside an HTML text node or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

# Universal Links / App Links — templated vs. real (MOB-008)

This folder holds **local fixtures**, not published files. `blackstory.app` is `apps/web` on
Vercel, and the served copies are route handlers there:

- `apps/web/src/app/.well-known/apple-app-site-association/route.ts`
- `apps/web/src/app/.well-known/assetlinks.json/route.ts`
- both built from `apps/web/src/lib/config/app-links.ts`, which is the authoritative copy.

Keep this folder in step with that module or delete the file that drifts. The values below are
duplicated here only so the shapes are readable next to the Expo config that depends on them.

## What's real

- `app.config.ts`'s `ios.associatedDomains: ['applinks:blackstory.app']` and `android.intentFilters`
  (an `autoVerify` `https://blackstory.app` filter) — these are structurally correct Expo config
  that will generate the right native entitlements/manifest entries via `expo prebuild`, gated to
  the `production` build variant only.
- The route allowlist and per-parameter validation in `../../src/lib/route-params.ts`, which
  is what actually decides what an incoming link is allowed to do once the OS hands it to the app.
  This is real, tested code, independent of whether the domain files below are ever published.

## What's templated (TODO markers inline)

- `apple-app-site-association` — **no longer templated.** The Apple Team ID `4Q2XU7D33G` is real
  (set 2026-07-22), so `blackstory.app/.well-known/apple-app-site-association` serves this for
  real. The `paths` list mirrors the web route shapes this app mirrors (`/explore`, `/search`,
  `/entity/*`, etc.) and excludes the web app's own API routes.
- `assetlinks.json` — still templated. The `sha256_cert_fingerprints` entry needs the **real
  Android release signing certificate's SHA-256 fingerprint**, which doesn't exist until a signing
  identity is provisioned (Google Play Console + EAS credentials). The web route fails closed with
  404 until `ANDROID_APP_LINKS_SHA256_FINGERPRINTS` is set in the deployed environment: a wrong
  fingerprint is worse than an absent file, because Android caches the failed verification.

## Why this doesn't block engineering work

Per the identity doc, these are store/account-provisioning gates that block *publishing* real
associated-domain files and *registering* the production bundle/application id — they do not
block the route/navigation work in this bead. `app.config.ts` scopes `associatedDomains`/
`intentFilters` to the `production` variant specifically so a `development`/`preview` build never
even attempts to claim `blackstory.app`.

## What "done" looks like later (not this bead)

1. ~~Real Apple Team ID~~ (done 2026-07-22) and Android release signing SHA-256 exist.
2. ~~Served from `blackstory.app`~~ (done: the `apps/web` routes above). The remaining step is
   setting `ANDROID_APP_LINKS_SHA256_FINGERPRINTS` on Vercel once the signing identity exists.
3. iOS/Android verify the association at install time; only then do `https://blackstory.app/*`
   links actually open the app instead of the browser. Until then, every `blackstory.app` link
   correctly opens as a normal web page — this is the inherent, correct behavior of Universal
   Links / App Links before verification is live, not a bug.

## Web fallback (inherent behavior, not mobile-side code)

An `https://blackstory.app/entity/{id}` link opened where the app is not installed, or where the
association above isn't yet verified, is just a normal HTTPS URL — it opens in the browser and
hits `apps/web`'s existing `/entity/[id]` route. No special mobile-side fallback code is needed or
present; this is exactly what Universal Links/App Links guarantee when done correctly (the link is
a real, working `https://` URL first, and an app-open is only ever an enhancement on top of that).

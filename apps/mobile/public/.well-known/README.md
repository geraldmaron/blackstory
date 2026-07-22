# Universal Links / App Links — templated vs. real (MOB-008)

This folder holds **local template fixtures**, not published files. Nothing here is served from
`https://blackbook.app/.well-known/` yet — that requires publishing from wherever `blackbook.app`
is actually hosted (Firebase Hosting per `apps/web`, or its own root), which is explicitly **not**
done by this bead. `apps/web` is out of this bead's exclusive ownership, and per
`docs/mobile/decisions/mobile-identity.md`'s open human gates, the real values these files need
don't exist yet.

## What's real

- `app.config.ts`'s `ios.associatedDomains: ['applinks:blackbook.app']` and `android.intentFilters`
  (an `autoVerify` `https://blackbook.app` filter) — these are structurally correct Expo config
  that will generate the right native entitlements/manifest entries via `expo prebuild`, gated to
  the `production` build variant only.
- The route allowlist and per-parameter validation in `../../src/app/_lib/route-params.ts`, which
  is what actually decides what an incoming link is allowed to do once the OS hands it to the app.
  This is real, tested code, independent of whether the domain files below are ever published.

## What's templated (TODO markers inline)

- `apple-app-site-association` — the `appID` field needs a **real Apple Team ID**
  (`docs/mobile/decisions/mobile-identity.md` open human gate #1: Apple Developer Program account
  not yet provisioned). The `paths` list mirrors the web route shapes this app mirrors
  (`/explore`, `/search`, `/entity/*`, etc.) and excludes the web app's own API routes.
- `assetlinks.json` — the `sha256_cert_fingerprints` entry needs the **real Android release
  signing certificate's SHA-256 fingerprint**, which doesn't exist until a real signing identity
  is provisioned (open human gate #2/#3: Google Play Console + EAS credentials).

## Why this doesn't block engineering work

Per the identity doc, these are store/account-provisioning gates that block *publishing* real
associated-domain files and *registering* the production bundle/application id — they do not
block the route/navigation work in this bead. `app.config.ts` scopes `associatedDomains`/
`intentFilters` to the `production` variant specifically so a `development`/`preview` build never
even attempts to claim `blackbook.app`.

## What "done" looks like later (not this bead)

1. Real Apple Team ID and Android release signing SHA-256 exist (human gates cleared).
2. This folder's two files are updated with real values and copied to wherever `blackbook.app`
   actually serves `/.well-known/*` from (an `apps/web` — or Firebase Hosting — concern, not
   `apps/mobile`'s).
3. iOS/Android verify the association at install time; only then do `https://blackbook.app/*`
   links actually open the app instead of the browser. Until then, every `blackbook.app` link
   correctly opens as a normal web page — this is the inherent, correct behavior of Universal
   Links / App Links before verification is live, not a bug.

## Web fallback (inherent behavior, not mobile-side code)

An `https://blackbook.app/entity/{id}` link opened where the app is not installed, or where the
association above isn't yet verified, is just a normal HTTPS URL — it opens in the browser and
hits `apps/web`'s existing `/entity/[id]` route. No special mobile-side fallback code is needed or
present; this is exactly what Universal Links/App Links guarantee when done correctly (the link is
a real, working `https://` URL first, and an app-open is only ever an enhancement on top of that).

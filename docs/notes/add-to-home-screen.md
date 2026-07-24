# Add BlackStory to the iPhone Home Screen

Short owner note: how to pin the public site as an app icon, and what that does
(and does not) mean.

## How to install (iPhone / iPad · Safari)

1. Open the live site in **Safari** (not Chrome or in-app browsers).
2. Tap the **Share** button (square with an up arrow).
3. Scroll and tap **Add to Home Screen**.
4. Confirm the name **BlackStory**, then tap **Add**.

The icon uses the book-and-pin mark on Archive Paper. Tapping it opens the site
in a standalone window (no Safari address bar), still loaded from the network.

## Android (Chrome)

Chrome may offer **Install app** / **Add to Home screen** from the menu when
the web app manifest is present. Same idea: shortcut + standalone chrome,
online-first.

## What works

- Home-screen icon and name **BlackStory**
- Standalone display (no browser chrome)
- Theme colors: Archive Paper (`#F4EFE5`) light / Black Ink (`#0A0A0A`) dark
- Apple touch icon already served for iOS bookmarks

## Limits (especially iOS)

- **Not offline.** There is no service worker cache. Airplane mode will not
  keep the full site available.
- **Not the App Store.** This is a web shortcut, not a native App Store / TestFlight
  build (`apps/mobile` is separate).
- **Safari only on iOS** for reliable Add to Home Screen. Other browsers often
  cannot install the same way.
- **Storage and push** are limited vs native apps; do not expect push
  notifications or background sync from this install.
- **Updates** arrive when the user opens the site online; there is no separate
  app-update channel for the home-screen icon.

## Repo pointers

- Manifest: `apps/web/public/manifest.webmanifest`
- Icons: `apps/web/public/brand/icon-*.png` (from `brand/app-icons/`)
- Metadata: `apps/web/src/app/layout.tsx` (`manifest`, `appleWebApp`, `viewport.themeColor`)

# Pattern: official-properties page

**Status:** documented pattern only — no route exists yet. Do not fabricate placeholder social
URLs to fill this pattern in early; wire real `sameAs` links only once the accounts in
[`pre-launch-operator-protection.md`](../runbooks/pre-launch-operator-protection.md) §4 are
actually reserved. A page with fake/placeholder social links would be worse than no page: it would
itself be a false claim of official presence.

## Why

Brand-impersonation defense (Section 4 of the operator-protection runbook) needs a way for a
confused reader, journalist, or platform-abuse reviewer to *prove* which properties are the real
ones. A page is not enough on its own — the two things that make it verifiable rather than just
assertion are:

1. **`rel="canonical"`** on the page itself, so search engines and readers resolve to one
   authoritative URL for "official properties" even if the page is mirrored, screenshotted, or
   linked from elsewhere.
2. **`schema.org` structured data with `sameAs`**, so the *domain itself* — not a page a
   third party could also copy — makes a machine-readable claim about which external profiles
   belong to it. This is the same mechanism Wikipedia/Wikidata and most verified-organization
   sites use; search engines and some platforms' trust/safety tooling already parse it.

## Pattern

A future route (owning bead TBD — likely folds into the `about` section or a dedicated
`/official-properties` path; not decided here) should render:

```html
<link rel="canonical" href="https://<real-domain>/official-properties" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BlackStory",
  "url": "https://<real-domain>",
  "sameAs": [
    "https://github.com/<real-org>",
    "https://<real-social-handle-1>",
    "https://<real-social-handle-2>"
  ]
}
</script>
```

Notes on the pattern, not prescriptions for a specific implementation:

- `sameAs` should list only accounts actually reserved and actively controlled — an entry here is
  an official claim, so a stale or never-actually-claimed handle is worse than omitting it.
- The visible page content (not just the structured data) should also list the same properties in
  human-readable form, since not every reader's tooling parses JSON-LD, and a human moderator
  reviewing an abuse report is exactly the audience this page exists for.
- Next.js App Router implementation notes for whoever builds the route: `metadata.alternates.canonical`
  (see `apps/web/src/app/layout.tsx` for the existing `metadata` export convention and
  `metadataBase` usage) covers the `rel="canonical"` tag without hand-writing a `<link>`; the
  JSON-LD block can be emitted as an inline `<script type="application/ld+json">` in the page
  component, following the same `metadata` export patterns already used by
  `apps/web/src/app/opengraph-image.tsx` and `apps/web/src/app/icon.tsx` for other per-page
  metadata generation.
- Keep the list short and load-bearing — this page is not a general social-links directory, it is
  specifically the impersonation-defense artifact referenced from the operator-protection runbook
  and (once real) from `platform-takedown.md`'s evidence pack.

## References

- [`../runbooks/pre-launch-operator-protection.md`](../runbooks/pre-launch-operator-protection.md) §4 — where the real accounts get reserved before this page is filled in
- [`../runbooks/incidents/platform-takedown.md`](../runbooks/incidents/platform-takedown.md) — evidence-pack use of this page once real
- `apps/web/src/app/layout.tsx` — existing `metadata`/`metadataBase` convention to extend

# Mobile App Epic — Native iOS and Android Application

Program source document for the Beads epic `black-book-mobile` (external ref `MOB-EPIC`)
and its children `MOB-001` through `MOB-022`. Beads is the source of truth for status,
dependencies, and acceptance criteria; this document is the human-readable program index.

- Baseline commit: `46be8a996d9d51ad7c5484e7f3425b355cb08711`
- Created: 2026-07-19 by mobile-program-review
- Epic bead: `black-book-mobile`

## Outcome

Ship a production-quality native iOS and Android reader that matches the public web
application's truth, evidence, map, dignity, brand, and correction posture — without
duplicating canonical data or weakening security.

## Program invariants

These hold across every child bead unless an accepted ADR explicitly supersedes them:

1. **Stack**: Expo React Native with custom development builds and MapLibre Native,
   unless MOB-002 records evidence that invalidates the decision.
2. **Read boundary**: `apps/api-public` is the mobile read surface. No direct
   canonical/research Firestore access from any client.
3. **Sharing**: only environment-neutral contracts and pure behavior are shared
   across web/mobile (no app-to-app imports, no server-only transitive deps).
4. **Releases**: immutable release artifacts with atomic activation and proven rollback.
5. **Identity first**: product identity (MOB-001) resolves before any permanent store
   resource is created.
6. **Client trust**: App Check is attestation, not authorization. The server stays
   authoritative; a compromised client must not gain a canonical write path.
7. **Privacy**: no ad/tracking SDKs; no query text, correction content, precise
   location, or sensitive entity classifications in logs or crash reports.

## Non-goals at launch

No user accounts, push notifications, social features, or full offline basemap unless
a child bead explicitly changes scope through measured evidence (governed by MOB-022).

## Bead index

| Bead ID | Ref | Title | Size | Pri |
|---|---|---|---|---|
| `black-book-mobile` | MOB-EPIC | Native iOS and Android application | XXL | P0 |
| `black-book-mobile-001` | MOB-001 | Product identity, accounts, release prerequisites | M | P0 |
| `black-book-mobile-002` | MOB-002 | Architecture, threat model, contract boundary ADRs | L | P0 |
| `black-book-mobile-003` | MOB-003 | Versioned public contracts package (`packages/public-contracts`) | XL | P0 |
| `black-book-mobile-004` | MOB-004 | Bounded public API v1 in `apps/api-public` | XL | P0 |
| `black-book-mobile-005` | MOB-005 | Release-coupled bootstrap and map/content artifacts (completes ADR-013 activation) | XL | P0 |
| `black-book-mobile-006` | MOB-006 | Expo monorepo scaffold (`apps/mobile`) and native build foundation | L | P0 |
| `black-book-mobile-007` | MOB-007 | Brand tokens, assets, accessible UI primitives (from `brand/` source) | L | P1 |
| `black-book-mobile-008` | MOB-008 | Navigation, deep links, state restoration | L | P1 |
| `black-book-mobile-009` | MOB-009 | Typed API client, SQLite cache, offline mode, migrations | XL | P0 |
| `black-book-mobile-010` | MOB-010 | App Check, mobile security controls, privacy-by-design | XL | P0 |
| `black-book-mobile-011` | MOB-011 | Production map data, PMTiles, attribution, failure strategy | XL | P0 |
| `black-book-mobile-012` | MOB-012 | Native Explore map, synchronized list, filters, narrative sheet | XL | P1 |
| `black-book-mobile-013` | MOB-013 | Bounded mobile search and filters | L | P1 |
| `black-book-mobile-014` | MOB-014 | Entity, evidence, timeline, related-learning, media experience | XL | P1 |
| `black-book-mobile-015` | MOB-015 | Learn and supporting public content surfaces | L | P1 |
| `black-book-mobile-016` | MOB-016 | Correction submission and opaque receipt status | L | P0 |
| `black-book-mobile-017` | MOB-017 | Cross-platform accessibility, motion, adaptive layout gate | XL | P0 |
| `black-book-mobile-018` | MOB-018 | Privacy-safe observability, performance and cost budgets | L | P0 |
| `black-book-mobile-019` | MOB-019 | Quality gates, CI, EAS builds, complete test matrix | XL | P0 |
| `black-book-mobile-020` | MOB-020 | Beta distribution, store records, privacy disclosures, review packet | XL | P0 |
| `black-book-mobile-021` | MOB-021 | Adversarial launch gate, rollback drill, staged rollout | XL | P0 |
| `black-book-mobile-022` | MOB-022 | Measured post-launch upgrades and explicit deferrals | M | P2 |

## External dependencies (existing repo beads)

| Existing bead | Title | Status at import | Gates |
|---|---|---|---|
| `repo-c004de5d` | BB-096: Brand pack v3 adoption | closed | MOB-007 |
| `repo-64a234ef` | BB-070: Map data platform and tiles | closed | MOB-011 |
| `repo-ba832a0c` | BB-101: Redesign quality gate (a11y, motion, performance, brand) | open | MOB-021 |

`repo-b4fcbc25` (Mobile app foundation: portable tokens, API contract, MapLibre Native
spike) predates this program; its deliverables are absorbed by MOB-002/003/007/011 and it
is linked to the epic as related work.

## Sequencing

Foundation first: MOB-001 (identity) is the only initially unblocked bead. MOB-002
(ADRs) unlocks contracts (MOB-003), which unlock the API (MOB-004), releases (MOB-005),
and the app scaffold (MOB-006). Feature work (MOB-012–016) sits behind the data layer
(MOB-009), security (MOB-010), and map decision (MOB-011). MOB-017–020 are launch-shaped
gates converging on MOB-021, the go/no-go. MOB-022 governs post-launch scope.

Run `bd show black-book-mobile` and `bd dep tree black-book-mobile-021` for the live graph.

## Closure discipline

Every child closes only on runtime evidence (builds, test runs, device recordings,
dashboards) — documentation alone cannot substitute. The epic closes on a signed-off
launch evidence index linking every child bead, production commit, store build, contract
version, release ID, test run, accessibility report, performance trace, privacy
declaration, and rollback drill.

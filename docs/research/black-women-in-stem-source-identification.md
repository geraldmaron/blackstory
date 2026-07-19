# Black Women Lead — source identity (owner-confirmed)

**Bead:** `repo-tt2u.8` / HUMAN `repo-ae8y`  
**Owner confirmation:** 2026-07-19 — intended source is **`https://blackwomenleadproject.org/`**  
**Status:** Identity **confirmed**. Source-policy / rights audit **not yet approved**. **No scrape, adapter enablement, or persistent capture until policy gate passes.**

---

## Canonical source identity

| Field | Value |
|-------|--------|
| Display name | Black Women Lead |
| Domain | `blackwomenleadproject.org` |
| Primary URL | `https://blackwomenleadproject.org/` |
| Custodian / organizer | Greater Grove Hall Main Streets (GGHMS), Boston |
| Stated partners (public copy / press) | New England Patriots Foundation (funding); Northeastern University and Boston Public Library cited for online biographies |
| Geographic scope | Boston / Blue Hill Avenue public-art corridor (Roxbury–Dorchester) |
| Temporal scope | ~1700s through present day |
| Content type (verified) | Public-art / memorial biography project spotlighting **212** Black women leaders; homepage narrative + gallery imagery on WordPress |
| STEM-specific? | **No.** Homepage fields named: arts and culture, legislation, health, education, community building. The string `STEM` does **not** appear on the homepage prose sampled 2026-07-19. |
| Program label mismatch | Owner brief / epic language said “Black Women in STEM.” Confirmed domain is **Black Women Lead** (broader leadership). Treat STEM discovery as a **theme filter / query intent** over this corpus and/or separate authority sources — not as the site’s exclusive subject. |

---

## Source classification (provisional — pending rights review)

| Dimension | Provisional call | Notes |
|-----------|------------------|-------|
| Lane | Community / editorial discovery lead (not federal authority) | Local nonprofit public-art project |
| Authority tier | Community / secondary for most claims; may cite or link to stronger authorities | Not a government or archival authority of record |
| Evidence role | Discovery lead + place-connected Boston history; **not** sole-source corroboration for publication | Align with American Blackstory RSS posture |
| Living people | **Yes** — project explicitly includes present-day leaders | Living-person protections required; no home addresses / private contact harvest |
| Access method preference | 1) Official structured API if useful 2) Feed 3) Sitemap/static HTML 4) Curated crawl last | See probe below |
| Approval state | **Disabled / not registered** | Do not add live adapter until policy bead closes |

---

## No-persist probe (2026-07-19)

Probe UA: `BlackStorySourceAudit/0.1 (+research; no-persist probe)`. Responses were inspected in memory only; **no fixture capture, no Firestore write, no full-body retention.**

### robots.txt

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://blackwomenleadproject.org/wp-sitemap.xml
```

**Robots gate:** Public site content is not disallowed to `*`. Robots alone does **not** satisfy terms/rights.

### Feed / API / sitemap

| Endpoint | Result |
|----------|--------|
| `GET /feed/` | RSS 2.0 present; channel is effectively a WordPress default (“Hello world!” post, 2025-09-05) — **not** a biography feed |
| `GET /wp-json/wp/v2/posts` | Returns the same stub post |
| `GET /wp-json/wp/v2/pages` | Only `sample-page` besides home |
| `GET /wp-sitemap.xml` | Index of posts, pages, categories, users sitemaps |
| Privacy / terms pages | **Not found** via `pages?slug=privacy|privacy-policy|terms|terms-of-use` |

### Homepage content (metadata-level)

- Title: “Black Women Lead”
- About copy confirms GGHMS + Patriots Foundation + 212 banners on Blue Hill Avenue
- Mentions Boston Public Library and Northeastern University in on-page narrative
- Same-site links are mostly gallery images under `/wp-content/uploads/` plus feed/wp-json — **no per-leader profile URLs discovered in the homepage link set**

### Strong inference

The public WordPress install looks **thin relative to the 212-banner project** described in press (Axios, CBS Boston, Bay State Banner). Online biographies may live with BPL/Northeastern partners, offline, or not yet published as crawlable profile pages. **Do not assume HTML profiles exist on this domain until a page inventory proves them.**

### Unresolved (block adapter work)

1. Written terms of use / license for republication of biographies, portraits, and selection text  
2. Whether BPL/Northeastern host the structured bios under a clearer rights regime  
3. Portrait/banner image rights (artists, GGHMS, funders) — almost certainly **not** free for bulk retention  
4. Whether WP will gain custom post types for leaders later  
5. Contact path for rights review with GGHMS  

---

## Living-person and dignity posture

- Corpus mixes historical and **living** figures (e.g. contemporary elected officials appear in press coverage of the banner set).
- Treat as **living-person-sensitive** by default for any present-tense profiles.
- Forbidden without separate justification: private addresses, personal phones, private emails, family details without historical relevance, biometric/race inference from portraits.
- Black identity here is **project-asserted** (the project’s inclusion criterion), not something BlackStory may infer from names or images for unrelated records.

---

## Acquisition recommendation (after policy approval only)

1. **Prefer partner structured corpora** (BPL / Northeastern bios) if they exist with clearer licenses — audit those as **related source identities**, not as independent corroboration of the same text.  
2. If this domain remains the primary surface: **RSS is currently useless** for leader inventory; prefer **sitemap + selective page fetch** only after rights review; keep retention **metadata/snippet** unless rights allow more.  
3. Register adapter **disabled**; fixtures from permitted captures; canary; explicit approval.  
4. For “Black women in STEM” operator goals: use **STEM-intent query plans** against authorities (NASA, ORCID, patents, etc.) **and/or** filter this Boston leadership set by occupation evidence — do not rename this source “STEM.”

---

## Explicit non-actions (still in force)

- No Scrapy/Crawlee/Playwright run against this domain  
- No bulk image download of banners/portraits  
- No `registerSource` enablement  
- No publication from this source alone  

---

## Related docs

- Program audit: `docs/research/entity-acquisition-current-state-audit.md`  
- Crawler decision: `docs/adr/ADR-019-acquisition-crawler-runtime.md`  
- Prior empty-candidate research (superseded for identity only): git history of this file before owner confirmation  

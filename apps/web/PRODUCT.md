# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Readers, educators, journalists and community researchers who trust nothing by default and need accountable place history. On the record page the job is to check one record, see its sources, and see how strongly each claim is supported. Many arrive from a search result or a shared link, so the page has to stand on its own. (Confirmed by the owner 2026-11-08; wording from docs/ui/story.md.)

## Product Purpose

BlackStory is an archive of record with receipts. Every fact traces to evidence (source, capture, confidence) and, when sources conflict, the conflict itself is kept on the record. Core line: History, pinned to place. The record page is the unit of that promise: one person, place, institution or event, with its claims and their sources.

## Positioning

Presence and proof together. Black history is documented in every state, county and neighborhood, and for everything shown the receipts are visible. It is neither a crowdsourced trivia site nor a raw research dump; only claims that clear the evidence bar get a public page.

## Operating Context

One person runs it. Records are published from a Postgres-backed catalog (about 4,200 live records) and rendered on the server. Record pages are citations, so they must return real content in raw HTML, keep their URLs (`/entity/{id}` addressing is unchanged), and keep working if JavaScript fails. Public pages carry a research-maturity and an evidence-grade vocabulary that must read in plain words; internal identifiers, release ids and raw enums never appear.

## Capabilities and Constraints

- Scope of this work: the entity record room (`/entity/[id]`) and the shared pieces it uses (evidence grade, claims, mast and media, visit block). Place, invention, law and book templates keep their layouts for now.
- Confidence is never color alone. Every level pairs color with text and a non-color glyph. No red or alarm hues for violence-adjacent records.
- Points render no sharper than stored precision. Living-person protection is load-bearing (no street-level residence, unknown living status is treated as living).
- Disputes stay visible: both values remain on the record.
- Accepted claims, sources, grades, status history, timeline, related records and a sensitivity banner already exist as data. Do not invent facts or fields.
- Open decision: whether place, invention, law and book adopt the same anatomy later.

## Brand Commitments

Name BlackStory, official book-and-pin lockup used as artwork only (never retyped). Type: Schibsted Grotesk for headlines, Geist for UI, Newsreader for editorial text, Geist Mono for data, citations, dates and confidence. Black and paper lead, copper points (about 10 to 15 percent of a composition). Radii 8, 16 and 28 px. No gradients, glows, bevels, glass or 3D. Dark theme is first class. Copy rules in docs/ui/story.md: two speakers only (the archive, or the owner as "I"), never "we"; no em dashes, limited colons, no marketing superlatives; internal pipeline words (quarantine, promotion, research case, maturity enums) never public.

## Evidence on Hand

Live records and claims in Supabase (published.release_entities). Binding design sources in the repo: docs/ui/brand.md, docs/ui/story.md, packages/ui/src/styles/tokens.css, docs/redesign/SURFACES.md and README.md. A rendered screenshot of the current claims section was supplied by the owner on 2026-11-08. No user research, analytics or testimonials are on hand; do not fabricate any.

## Product Principles

1. The record is a page, not a panel. It must stand alone as a citation.
2. Show the receipts. Every claim sits next to its source and how strongly the source carries it.
3. One evidence vocabulary across the site, in plain words, never color alone.
4. Presence over incident. A record leads with what is documented about the place or person, not the worst thing that happened.
5. State what is unknown. An honest gap is a complete answer.

## Accessibility & Inclusion

Color is never the only signal. Text and glyph accompany every confidence level, and targets are at least 44px on touch. Respect reduced motion. Dark and light themes both meet contrast. Phone-width layouts matter because many readers arrive from shared links.

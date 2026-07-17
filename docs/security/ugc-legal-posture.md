# CCPA/CPRA publicly-available posture and fair-use ground truth (BB-077)

Written so a future counsel review starts from documented ground truth rather than nothing.
**This is engineering documentation, not legal advice** — it records the assumptions the BB-077
compliance layer was built against so counsel can confirm, correct, or supersede them.

## CPRA's publicly-available-information exception

The California Privacy Rights Act (CPRA, amending the CCPA) excludes "publicly available"
information from several of its personal-information obligations (Cal. Civ. Code
§ 1798.140(v)(2)). Our working assumption: content a UGC source itself makes public — a public
Reddit post, a public RSS item, a publicly indexed web page — generally falls within that
exception, so it is not, by itself, "personal information" the statute restricts us from
processing.

This assumption is **general and defeasible**. It does not cover:

- content the platform later makes non-public (a deleted or removed post) — see below;
- information CPRA still governs regardless of public posture (e.g. certain sensitive personal
  information categories);
- state/federal statutes other than CPRA that may apply independently (rights of publicity,
  defamation, doxxing/harassment statutes, etc.) — those sit outside this document's scope.

## Reddit's deletion-sync obligation is contractual, not privacy-law-conditional

Reddit's deletion-sync requirement — purge derived content within 48 hours of the user deleting
the original on Reddit — comes from **Reddit's API/developer terms**, a contract Black Book
enters into to access the API. It is not derived from, and does not depend on, a CPRA "publicly
available" analysis.

This matters operationally: **the obligation is enforced unconditionally**, not gated behind a
runtime legal-posture check. Even if a future counsel review concluded that CPRA's
publicly-available exception would otherwise permit retaining the content, the contractual
obligation still applies. The implementation reflects this directly —
`packages/domain/src/rights/obligations.ts`'s Reddit entry hardcodes
`deletionSync: { required: true, maxHours: 48, contractual: true }` with no conditional
legal-analysis branch, and the deletion-sync framework
(`packages/domain/src/rights/deletion-sync.ts`) has no "skip if publicly available" escape
hatch.

If Reddit's terms change, the obligations-registry entry is the single place to update; the
deletion-sync mechanics do not need to change.

## Fair-use posture for the evidence-pointer doctrine

The evidence-pointer doctrine (`packages/domain/src/rights/evidence-pointer.ts`,
`docs/security/ugc-compliance-layer.md`) is built on two lines of precedent:

- **Search-caching / indexing**: *Field v. Google, Inc.*, 412 F. Supp. 2d 1106 (D. Nev. 2006),
  found Google's caching of web pages for search purposes to be fair use where the cache served
  an indexing function and did not substitute for the original. We rely on the general
  principle — indexing plus minimal excerpting for relevance judgment does not substitute for
  the work — not on any specific holding language reproduced here.
- **Minimal-excerpt display**: the Google Books litigation (*Authors Guild v. Google, Inc.*, 804
  F.3d 202 (2d Cir. 2015)) found that displaying short, non-contiguous snippets in service of a
  transformative (search/indexing) purpose is fair use, while a full-text substitute would not
  be.

The engineering translation: never self-host a full copy of third-party UGC. Store a short
snippet (capped at 320 characters / 60 words — the "1-2 sentences, the minimum needed to judge
relevance" the bead specifies), an outbound link back to the source, and a Wayback/Internet
Archive capture pointer so full-page preservation is delegated to an archive whose own fair-use
posture is separately established, rather than duplicated on our infrastructure.

This is a documented engineering posture informed by publicly available case outcomes, not a
substitute for case-specific legal advice. Any specific publication decision that turns on
close fair-use questions (e.g. a borderline excerpt length, a disputed transformative-use
argument) should go through counsel review, not just this document.

## What this document intentionally does not cover

- Rights of publicity / right-to-be-forgotten regimes outside CPRA.
- Non-US jurisdictions (GDPR, etc.) — Black Book's current UGC sources and obligations registry
  entries (Reddit, Brave, Exa, RSS, Internet Archive, DPLA) are evaluated against US law only.
- Platform-specific terms for sources not yet in the obligations registry
  (`packages/domain/src/rights/obligations.ts`) — any new UGC source needs its own entry and,
  where its terms warrant it, its own version of this document's Reddit section.

## Related implementation

- `packages/domain/src/rights/obligations.ts` — per-source obligations registry.
- `packages/domain/src/rights/evidence-pointer.ts` — evidence-pointer doctrine schema/tests.
- `packages/domain/src/rights/deletion-sync.ts` — deletion-sync framework.
- `packages/domain/src/rights/living-person-ugc.ts` — living-person ethics rules.
- `packages/domain/src/rights/takedown.ts` — takedown/contest routing.
- `docs/security/ugc-compliance-layer.md` — full BB-077 deliverable map.

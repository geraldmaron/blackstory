# Chapter fact validation

**Status:** binding for every article published on the `/chapters` surface.
Chapters are canonical in `bb_reference.articles` (Supabase), edited via
`articles.ts pull` into gitignored local drafts and applied back; they do not
live as fixture files in git. This document defines how facts get
into chapter prose and how they are validated before publish. It composes
standards that already exist elsewhere in this repo; where it cites another
document, that document governs. Nothing here replaces the machine gates in
`packages/ops-data/scripts/articles.ts` — it defines the human/agent research
protocol those gates cannot check.

## Why this document exists

The pipeline gates prove *internal traceability*: every figure in prose
resolves to a published theme-impact-packet observation, every
`primaryDocument` refId to a packet artifact, every reference URL to a
T1–T3 source, every load-bearing figure to two independent anchors. What no
gate can prove is that a *narrative* fact — an arrest date, a headline, a
named person on a named block — is true. One fabricated detail costs the
site the trust every validated number earned. This document closes that gap.

## The two classes of fact

| Class | Example | Validated by |
|---|---|---|
| **Measured** (numbers, series values) | "about fifty-six times what the average Black person held" | Packet observation binding, enforced by `verifyArticleReferences` + `assertArticleCitationIntegrity`; load-bearing figures additionally by the two-anchor rule (`gateLoadBearingAnchors`) |
| **Narrative** (events, people, dates, scenes, quotes) | "the Tribune ran the story that afternoon" | The research protocol below — no machine gate can check it |

A fact that is neither class — atmosphere invented for color — does not go
in a chapter. If a detail cannot be sourced, the scene is written without it.

## Research protocol for narrative facts

Every narrative fact in chapter prose passes three layers before publish.
Single-pass research, however careful, is not sufficient; this project has
been burned by confidently fabricated data before (the BJS precedent).

**Layer 1 — Research pass.** Facts are gathered from fetched sources, never
from a model's memory. Each fact is recorded with: the fact as one precise
sentence; at least **two independent sources** (different institutions — a
reprint or syndication of the same original is one source, the same lens
`docs/research/citation-independence-review-signal.md` applies to citations);
the exact URL fetched; and a verbatim supporting quote of at most 40 words.
At least one source must be primary or official (T1/T2 under
`lookupSourceTier`). Acceptable institutions follow the tier registry:
federal archives (LOC, NARA, govinfo), agency history offices, state
historical societies, university projects and presses, established museums,
peer-reviewed scholarship. Newspapers enter through the Chronicling America
and Black-press dignity rules (`docs/research/chronicling-america-adapter.md`,
`docs/research/black-press-discovery.md`): snippets ≤ 320 chars / 60 words,
no sensational framing, publication + place + date preserved.

**Layer 2 — Independent verification pass.** A second researcher (or agent)
who did not do Layer 1 re-fetches every cited URL and confirms, against the
page text alone, that the fact and quote are supported. Anything not
confirmed is cut or moved to a dispute. The verifier's job is to refute,
not to polish.

*Named-attribution exception.* A fact carried by only one institution may
still appear when that institution is the primary record holder for it (a
commission's own report, an agency's own ledger, a memoir for its author's
words) — but then the prose names the source in the sentence ("the
commission's report puts the crowd at…"), so the reader sees exactly whose
record carries the claim. Anonymous single-source facts are cut. Layer 2
still verifies the fact against the named source.

**Layer 3 — Editorial integration check.** Whoever writes the prose confirms
each fact appears with its citation (`[ref:id]` to a reference carrying the
source URL, or a `primaryDocument` block bound to a packet artifact), that
quotes are verbatim, and that no sentence asserts more than its source does.
Disputed facts (death tolls, motives, lost documents) are written as
disputes per `docs/content/neo-voice.md` Part V ("Disputes in prose") — both
records shown in the prose, never resolved into one number the record
doesn't support.

**Then the machine gates run** (`validate → apply → promote → project`):
schema, citation integrity, source tiers, anchors, packet binding, DOI
checks (`CHECK_DOIS=1`), and the 2,000-word prose floor. The gates are the
fourth check, not the first.

## Immersion requirements

A chapter is a place the reader stands, not a summary they receive. The
binding craft rules are `docs/content/neo-voice.md` (Part III: era structure,
second-person cold open, the rule in force quoted verbatim, measured odds,
jump-cut; Part II/IV: specific person, specific hour; prose builds stakes,
data delivers the verdict; register; disputes in prose; one earned
flourish). Two additions this document makes binding:

1. **Events get buildup, not verdicts.** An event narrated in a chapter
   shows its sequence — what was ordinary the day before, what triggered it,
   what happened hour by hour — using only sourced detail. "Over two days,
   white rioters burned it down" is a verdict; the trigger, the crowd, and
   the first fire are the story, and each of those beats must be sourced
   under the protocol above.
2. **Minimum 2,000 words of body prose** per published chapter, enforced as
   a hard gate in `articles.ts` (`gateProseWordFloor`). Depth comes from
   sourced detail, never from padding; if a chapter cannot reach the floor
   with validated material, it needs more research, not more adjectives.

## Editorial hygiene: the applied draft is the published artifact, not an edit log

A chapter draft (`articles.ts pull` → `packages/ops-data/drafts/*.article.json`,
applied back with `articles.ts apply`) becomes the content a reader sees once
it ships — it is not a private workspace. Do not leave notes narrating what
changed and why between drafts inside the article document itself. That
reasoning is genuinely useful during editing, but it belongs in the session's
record of the change (the review findings, the issue), not in the document
that is itself the product.

## What this document does not change

Causal language stays governed by
`docs/methodology/juxtaposition-not-causation.md` and the packet
`method_stance`; naming, agency, and uncertainty vocabulary stay governed by
`docs/methodology/scholarship-principles.md`; the packet data contract stays
`packages/domain/src/statistics/theme-impact-packet.ts`. A better-sourced
scene never licenses a causal claim the packet stance doesn't gate.
